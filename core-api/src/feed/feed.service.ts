import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Post } from 'src/modules/posts/entities/post.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { Reaction } from 'src/modules/posts/reactions/entities/reaction.entity';
import { RedisService } from 'src/infra/redis/redis.service';
import { RelationType } from 'src/common/enums/relation.enum';
import { PrivacyType } from 'src/common/enums/privacy.enum';

/*Số lượng bài viết tối đa trong feed */
const MAX_FEED_SIZE = 500;

/*Ngưỡng số lượng follower để phân loại user là celebrity */
const CELEBRITY_THRESHOLD = 1000;

/*TTL (giây) cho cache các danh sách theo dõi/ chặn */
const RELATION_CACHE_TTL = 60;

/*Khóa cache cho các bài viết tiềm năng trong Explore */
const EXPLORE_CANDIDATES_KEY = 'explore:candidates';

/** TTL cho cache các bài viết tiềm năng */
const EXPLORE_CANDIDATES_TTL = 300;

/*Số lượng bài viết tối đa trong pool Explore */
const EXPLORE_CANDIDATES_LIMIT = 200;

/*Số ngày để xem xét các bài viết trong Explore */
const EXPLORE_WINDOW_DAYS = 30;

// ---------- Xếp hạng cá nhân hóa cho trang Khám Phá ---------
/*TTL cho cache hồ sơ sở thích của người dùng */
const INTEREST_CACHE_TTL = 1800;

/*Cửa sổ thời gian (ngày) để xây dựng hồ sơ sở thích*/
const INTEREST_WINDOW_DAYS = 60;

/* Số lượng hashtag sở thích cho mỗi user */
const INTEREST_TOP_K = 20;

/* Số bài viết tối đa trên mỗi tác giả trong feed Khám Phá ( Tăng độ đa dạng nội dung) */
const MAX_POSTS_PER_AUTHOR = 6;

/** TTL (seconds) for a user's cached personalized Explore ranking */
const EXPLORE_RANKED_TTL = 120;
/** Ranking weights: engagement, topic affinity, social proof */
const W_ENGAGEMENT = 1;
const W_TOPIC = 1.2;
const W_SOCIAL = 1.5;
/** TTL (seconds) for a user's "seen" set in the Explore feed */
const SEEN_TTL_SECONDS = 7 * 24 * 3600;
/** Max number of seen post IDs kept per user (trim oldest beyond this) */
const SEEN_MAX = 1000;

/** A candidate post in the Explore pool with the signals needed to re-rank it */
interface ExploreCandidate {
  id: string;
  authorId: string;
  hashtags: string[];
  score: number;
}

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
    private readonly redisService: RedisService,
  ) {}

  // ═══════════════════════════════════════════
  //  PUBLIC: Feed Endpoints
  // ═══════════════════════════════════════════

  /**
   * Gets the "Following" feed for a user.
   * Reads from Redis Sorted Set (pre-populated by fanout),
   * merges with celebrity posts, and applies privacy/block filters.
   *
   * @param userId - Current user ID
   * @param cursor - Timestamp cursor for pagination (undefined = latest)
   * @param limit - Number of posts to return
   */
  async getFollowingFeed(userId: string, cursor?: number, limit: number = 10) {
    try {
      // Ensure feed is populated (cold start handling)
      await this.ensureFeedPopulated(userId);

      // 1. Get post IDs from user's Redis feed
      const maxScore = cursor ? cursor - 1 : '+inf';
      const postIds = await this.redisService.zRevRangeByScore(
        `feed:${userId}`,
        maxScore,
        '-inf',
        0,
        limit + 5, // Fetch extra to account for filtered posts
      );

      // 2. Merge with celebrity posts (Fan-out on Read)
      const celebrityPostIds = await this.getCelebrityPostIds(
        userId,
        maxScore,
        limit,
      );
      const allPostIds = [...new Set([...postIds, ...celebrityPostIds])];

      if (allPostIds.length === 0) {
        return { data: [], meta: { next_cursor: null, has_more: false } };
      }

      // 3. Batch query posts from DB
      const posts = await this.getPostsByIds(allPostIds);

      // 4. Apply privacy + block filters
      const blockedUserIds = await this.getBlockedUserIds(userId);
      const followingIds = await this.getFollowingIds(userId);
      let filteredPosts = this.applyPrivacyFilter(
        posts,
        userId,
        blockedUserIds,
        followingIds,
      );

      // 4.5 Deduplicate original posts and aggregate reposters
      const seenOriginals = new Map<string, any>();
      filteredPosts.forEach((p: any) => {
        const originalId = p.shared_post_id || p.id;

        if (!seenOriginals.has(originalId)) {
          if (p.shared_post_id) {
            // Khởi tạo mảng người đăng lại nếu bài này là Repost
            p.reposted_by = [{ id: p.user.id, username: p.user.username }];
          }
          seenOriginals.set(originalId, p);
        } else {
          // Trùng lặp -> lấy bản ghi cũ ra và thêm user vào mảng
          const keptPost = seenOriginals.get(originalId);
          if (p.shared_post_id && keptPost.shared_post_id) {
            // Đảm bảo chưa có trong mảng thì mới push vào (tránh trùng)
            if (!keptPost.reposted_by.some((u: any) => u.id === p.user.id)) {
              keptPost.reposted_by.push({
                id: p.user.id,
                username: p.user.username,
              });
            }
          }
        }
      });
      filteredPosts = Array.from(seenOriginals.values());

      // 5. Sort by created_at DESC and take limit
      filteredPosts.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const result = filteredPosts.slice(0, limit);

      // 6. Enrich with interaction data
      const enriched = await this.enrichInteractions(result, userId);

      // 7. Build cursor
      const lastPost = enriched[enriched.length - 1];
      const nextCursor = lastPost
        ? new Date(lastPost.created_at).getTime()
        : null;

      return {
        data: enriched,
        meta: {
          next_cursor: nextCursor,
          has_more: enriched.length === limit,
        },
      };
    } catch (error) {
      console.error('Error fetching following feed:', error);
      throw new InternalServerErrorException('Error fetching feed');
    }
  }

  /**
   * Gets the "Explore" feed (Khám phá) — a personalized discovery feed.
   *
   * Posts are taken from the globally-ranked engagement pool and re-ranked per
   * user by: engagement + hashtag interest affinity + social proof (likes from
   * people you follow), with an author-diversity cap. The personalized ranking
   * is cached per user ({@link EXPLORE_RANKED_TTL}s) so `cursor` is a numeric
   * **offset** into that ranked list and "load more" is cheap.
   *
   * @param userId - Current user ID
   * @param cursor - Offset into the ranked list (undefined = start)
   * @param limit - Number of posts to return
   */
  async getExploreFeed(userId: string, cursor?: number, limit: number = 10) {
    try {
      const offset = cursor && cursor > 0 ? cursor : 0;

      const rankedIds = await this.getPersonalizedExploreRanking(userId);
      if (rankedIds.length === 0) {
        return { data: [], meta: { next_cursor: null, has_more: false } };
      }

      const pageIds = rankedIds.slice(offset, offset + limit);
      if (pageIds.length === 0) {
        return { data: [], meta: { next_cursor: null, has_more: false } };
      }

      // Mark these posts as "seen" so future builds push them down / surface fresh.
      const now = Date.now();
      await this.redisService.zAdd(
        `explore:seen:${userId}`,
        ...pageIds.flatMap((id) => [now, id]),
      );
      await this.redisService.expire(
        `explore:seen:${userId}`,
        SEEN_TTL_SECONDS,
      );
      await this.redisService.zRemRangeByRank(
        `explore:seen:${userId}`,
        0,
        -(SEEN_MAX + 1),
      );

      // Hydrate and restore the ranked order (getPostsByIds sorts by created_at).
      const posts = await this.getPostsByIds(pageIds);
      const orderMap = new Map(pageIds.map((id, idx) => [id, idx]));
      posts.sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );

      const enriched = await this.enrichInteractions(posts, userId);

      const nextOffset = offset + limit;
      const hasMore = nextOffset < rankedIds.length;

      return {
        data: enriched,
        meta: {
          next_cursor: hasMore ? nextOffset : null,
          has_more: hasMore,
        },
      };
    } catch (error) {
      console.error('Error fetching explore feed:', error);
      throw new InternalServerErrorException('Error fetching feed');
    }
  }

  /**
   * Builds (or reads from cache) the personalized, diversity-aware ordering of
   * Explore post IDs for a user. Cached at `explore:ranked:{uid}` so pagination
   * is stable and subsequent pages avoid recomputation.
   *
   * Seen-tracking: posts the user already viewed are pushed to the bottom
   * (oldest-seen first) so refresh/scroll surfaces fresh content, while never
   * leaving the feed empty — once all unseen are exhausted, seen posts recycle.
   */
  private async getPersonalizedExploreRanking(
    userId: string,
  ): Promise<string[]> {
    const cacheKey = `explore:ranked:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        /* corrupted cache -> recompute */
      }
    }

    const candidates = await this.getExploreCandidates();
    const blockedSet = new Set(await this.getBlockedUserIds(userId));
    const followingSet = new Set(await this.getFollowingIds(userId));

    // Per-user filtering: hide own posts, blocked authors, and people already
    // followed (those belong in the Following feed).
    const visible = candidates.filter(
      (c) =>
        c.authorId !== userId &&
        !blockedSet.has(c.authorId) &&
        !followingSet.has(c.authorId),
    );

    if (visible.length === 0) {
      await this.redisService.set(
        cacheKey,
        JSON.stringify([]),
        EXPLORE_RANKED_TTL,
      );
      return [];
    }

    // Personalization signals
    const interest = await this.buildUserInterestProfile(userId);
    const socialMap = await this.getSocialProofMap(
      visible.map((c) => c.id),
      [...followingSet],
    );

    // Normalization bounds across the visible pool
    const scores = visible.map((c) => c.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const engRange = maxScore - minScore || 1;

    const topicRawOf = (c: ExploreCandidate) =>
      c.hashtags.reduce(
        (sum, tag) => sum + (interest[tag.toLowerCase()] || 0),
        0,
      );
    const maxTopic = Math.max(1, ...visible.map(topicRawOf));
    const maxSocial = Math.max(
      1,
      ...visible.map((c) => socialMap.get(c.id) || 0),
    );

    // Điểm cá nhân hóa (tất định) cho từng ứng viên
    const scoreMap = new Map<string, number>();
    for (const c of visible) {
      const engNorm = (c.score - minScore) / engRange;
      const topicNorm = topicRawOf(c) / maxTopic;
      const socialNorm = (socialMap.get(c.id) || 0) / maxSocial;
      scoreMap.set(
        c.id,
        W_ENGAGEMENT * engNorm + W_TOPIC * topicNorm + W_SOCIAL * socialNorm,
      );
    }

    // Seen-tracking: chưa xem lên trước, đã xem (cũ nhất trước) xuống sau.
    const seenMembers = await this.redisService.zRange(
      `explore:seen:${userId}`,
      0,
      -1,
    ); // thứ tự cũ -> mới (score = thời điểm xem)
    const seenOrder = new Map(seenMembers.map((id, idx) => [id, idx]));
    const seenSet = new Set(seenMembers);

    const unseen = visible.filter((c) => !seenSet.has(c.id));
    const seen = visible.filter((c) => seenSet.has(c.id));

    // Phần chưa xem: điểm cá nhân hóa giảm dần + đa dạng tác giả
    unseen.sort(
      (a, b) =>
        (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0) ||
        b.score - a.score,
    );
    const unseenRankedIds = this.applyAuthorDiversity(unseen);

    // Phần đã xem: xem lâu nhất trước (đỡ lặp lại ngay)
    seen.sort(
      (a, b) => (seenOrder.get(a.id) ?? 0) - (seenOrder.get(b.id) ?? 0),
    );
    const seenRankedIds = seen.map((c) => c.id);

    const rankedIds = [...unseenRankedIds, ...seenRankedIds];

    await this.redisService.set(
      cacheKey,
      JSON.stringify(rankedIds),
      EXPLORE_RANKED_TTL,
    );
    return rankedIds;
  }

  /**
   * Author-diversity pass: keep at most {@link MAX_POSTS_PER_AUTHOR} posts per
   * author near the top, push the overflow to the end. Input must be pre-sorted.
   */
  private applyAuthorDiversity(sorted: ExploreCandidate[]): string[] {
    const perAuthor = new Map<string, number>();
    const primary: string[] = [];
    const overflow: string[] = [];
    for (const c of sorted) {
      const n = perAuthor.get(c.authorId) || 0;
      if (n < MAX_POSTS_PER_AUTHOR) {
        primary.push(c.id);
        perAuthor.set(c.authorId, n + 1);
      } else {
        overflow.push(c.id);
      }
    }
    return [...primary, ...overflow];
  }

  /**
   * Force a fresh Explore ordering for a user (FB-style "tap to refresh"):
   * drops the cached ranking. The next fetch rebuilds it with seen-tracking, so
   * already-viewed posts sink and unseen ones surface (deterministic, no random).
   */
  async refreshExploreRanking(userId: string): Promise<{ ok: true }> {
    await this.redisService.del(`explore:ranked:${userId}`);
    return { ok: true };
  }

  /**
   * Builds (or reads from cache) a user's hashtag interest profile: a map of
   * `hashtag -> weight` aggregated from posts they reacted to, saved, or
   * authored within {@link INTEREST_WINDOW_DAYS} days. Cached at
   * `interest:{uid}`. Empty for brand-new users (cold start).
   */
  private async buildUserInterestProfile(
    userId: string,
  ): Promise<Record<string, number>> {
    const cacheKey = `interest:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Record<string, number>;
      } catch {
        /* corrupted cache -> recompute */
      }
    }

    const rows: Array<{ tag: string; score: string }> =
      await this.postRepository.query(
        `
        SELECT lower(tag) AS tag, SUM(weight) AS score
        FROM (
          SELECT unnest(p.hashtags) AS tag, 1.0 AS weight
          FROM reaction r JOIN post p ON p.id = r.post_id
          WHERE r.user_id = $1 AND r.is_hidden = false
            AND p.created_at >= NOW() - INTERVAL '${INTEREST_WINDOW_DAYS} days'
          UNION ALL
          SELECT unnest(p.hashtags) AS tag, 1.5 AS weight
          FROM save_post sp
          JOIN save_list sl ON sl.id = sp.save_list_id
          JOIN post p ON p.id = sp.post_id
          WHERE sl.user_id = $1
          UNION ALL
          SELECT unnest(p.hashtags) AS tag, 1.0 AS weight
          FROM post p
          WHERE p.user_id = $1
            AND p.created_at >= NOW() - INTERVAL '${INTEREST_WINDOW_DAYS} days'
        ) t
        WHERE tag IS NOT NULL AND tag <> ''
        GROUP BY lower(tag)
        ORDER BY score DESC
        LIMIT ${INTEREST_TOP_K}
        `,
        [userId],
      );

    const profile: Record<string, number> = {};
    for (const row of rows) {
      profile[row.tag] = parseFloat(row.score) || 0;
    }

    await this.redisService.set(
      cacheKey,
      JSON.stringify(profile),
      INTEREST_CACHE_TTL,
    );
    return profile;
  }

  /**
   * For the given candidate posts, counts how many of the people the user
   * follows have liked each one (social proof). Returns Map<postId, count>.
   */
  private async getSocialProofMap(
    postIds: string[],
    followingIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (postIds.length === 0 || followingIds.length === 0) return result;

    const rows = await this.reactionRepository
      .createQueryBuilder('r')
      .select('r.post_id', 'pid')
      .addSelect('COUNT(DISTINCT r.user_id)', 'cnt')
      .where('r.post_id IN (:...postIds)', { postIds })
      .andWhere('r.user_id IN (:...followingIds)', { followingIds })
      .andWhere('r.is_hidden = false')
      .groupBy('r.post_id')
      .getRawMany();

    for (const row of rows) {
      result.set(row.pid as string, parseInt(row.cnt, 10) || 0);
    }
    return result;
  }

  /**
   * Computes (or reads from cache) the globally-ranked Explore candidate pool:
   * the top {@link EXPLORE_CANDIDATES_LIMIT} public original posts from the last
   * {@link EXPLORE_WINDOW_DAYS} days, ordered by engagement score. Cached for
   * {@link EXPLORE_CANDIDATES_TTL}s so the heavy aggregate runs at most once per
   * window instead of on every request.
   */
  private async getExploreCandidates(): Promise<ExploreCandidate[]> {
    const cached = await this.redisService.get(EXPLORE_CANDIDATES_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as ExploreCandidate[];
      } catch {
        /* corrupted cache -> recompute */
      }
    }

    const engagementExpr = `(COUNT(DISTINCT reaction.id) * 2 + COUNT(DISTINCT comment.id) * 3) - (EXTRACT(EPOCH FROM (NOW() - post.created_at)) / 3600 * 0.5)`;

    const raw = await this.postRepository
      .createQueryBuilder('post')
      .leftJoin('post.user', 'user')
      .leftJoin('post.reactions', 'reaction')
      .leftJoin('post.comments', 'comment')
      .select('post.id', 'id')
      .addSelect('post.user_id', 'authorId')
      .addSelect('post.hashtags', 'hashtags')
      .addSelect(engagementExpr, 'score')
      .where('post.privacy = :privacy', { privacy: PrivacyType.PUBLIC })
      .andWhere('user.privacy = :uPrivacy', { uPrivacy: PrivacyType.PUBLIC })
      .andWhere('post.shared_post_id IS NULL')
      .andWhere(
        `post.created_at >= NOW() - INTERVAL '${EXPLORE_WINDOW_DAYS} days'`,
      )
      .groupBy('post.id')
      .addGroupBy('post.user_id')
      .orderBy(engagementExpr, 'DESC')
      .limit(EXPLORE_CANDIDATES_LIMIT)
      .getRawMany();

    const candidates: ExploreCandidate[] = raw.map((r) => ({
      id: r.id as string,
      authorId: r.authorId as string,
      hashtags: Array.isArray(r.hashtags) ? (r.hashtags as string[]) : [],
      score: parseFloat(r.score) || 0,
    }));

    await this.redisService.set(
      EXPLORE_CANDIDATES_KEY,
      JSON.stringify(candidates),
      EXPLORE_CANDIDATES_TTL,
    );
    return candidates;
  }

  // ═══════════════════════════════════════════
  //  PUBLIC: Fanout operations (called by BullMQ processor)
  // ═══════════════════════════════════════════

  /**
   * Fan-out a new post to all followers' feed caches.
   * For users with <CELEBRITY_THRESHOLD followers: push to each follower's feed.
   * For "celebrity" users: store in celebrity_posts sorted set (pulled on read).
   */
  async fanoutPost(postId: string, authorId: string, createdAt: Date) {
    const timestamp = new Date(createdAt).getTime();

    // Get all follower IDs (users who follow this author and have not muted them)
    const followers = await this.relationRepository.find({
      where: [
        {
          accept_side_id: authorId,
          relation_type: RelationType.FOLLOWING,
          is_restricted: false,
        },
      ],
      select: ['request_side_id'],
    });

    const followerIds = [
      ...new Set([...followers.map((f) => f.request_side_id)]),
    ];

    if (followerIds.length < CELEBRITY_THRESHOLD) {
      // ── Fan-out on Write: push to each follower's feed ──
      const BATCH_SIZE = 100;
      const pipeline = this.redisService.getClient().pipeline();

      for (let i = 0; i < followerIds.length; i++) {
        pipeline.zadd(`feed:${followerIds[i]}`, timestamp, postId);
        // Trim to keep max feed size
        if ((i + 1) % BATCH_SIZE === 0) {
          pipeline.exec();
          const newPipeline = this.redisService.getClient().pipeline();
          Object.assign(pipeline, newPipeline);
        }
      }

      // Trim all feeds to MAX_FEED_SIZE
      for (const followerId of followerIds) {
        pipeline.zremrangebyrank(`feed:${followerId}`, 0, -(MAX_FEED_SIZE + 1));
      }

      await pipeline.exec();
    } else {
      // ── Celebrity: store in celebrity_posts ──
      await this.redisService.set(`celebrity:${authorId}`, '1');
      const pipeline = this.redisService.getClient().pipeline();
      pipeline.zadd(`celebrity_posts:${authorId}`, timestamp, postId);
      pipeline.zremrangebyrank(`celebrity_posts:${authorId}`, 0, -201);
      await pipeline.exec();
    }

    // Cố ý KHÔNG thêm bài của tác giả vào feed "Đang theo dõi" của chính họ.
    // Bài của mình chỉ hiện ở trang cá nhân; feed "Đang theo dõi" chỉ gồm bài của
    // người mình theo dõi (kể cả khi họ chia sẻ lại bài của mình).
  }

  /**
   * Remove a deleted post from all followers' feeds.
   */
  async removePostFromFeeds(postId: string, authorId: string) {
    const followers = await this.relationRepository.find({
      where: [
        { accept_side_id: authorId, relation_type: RelationType.FOLLOWING },
      ],
      select: ['request_side_id'],
    });

    const followerIds = [...new Set(followers.map((f) => f.request_side_id))];

    const pipeline = this.redisService.getClient().pipeline();
    for (const followerId of followerIds) {
      pipeline.zrem(`feed:${followerId}`, postId);
    }
    pipeline.zrem(`feed:${authorId}`, postId);
    await pipeline.exec();
  }

  /**
   * Backfill a user's feed when they follow someone new.
   * Adds the followed user's recent posts to the follower's feed.
   */
  async backfillFeedOnFollow(userId: string, followedUserId: string) {
    const recentPosts = await this.postRepository.find({
      where: { user_id: followedUserId },
      order: { created_at: 'DESC' },
      take: 20,
    });

    if (recentPosts.length === 0) return;

    const pipeline = this.redisService.getClient().pipeline();
    for (const post of recentPosts) {
      const score = new Date(post.created_at).getTime();
      pipeline.zadd(`feed:${userId}`, score, post.id);
    }
    pipeline.zremrangebyrank(`feed:${userId}`, 0, -(MAX_FEED_SIZE + 1));
    await pipeline.exec();
  }

  /**
   * Clean a user's feed when they unfollow someone.
   * Removes the unfollowed user's posts from the feed.
   */
  async cleanupFeedOnUnfollow(userId: string, unfollowedUserId: string) {
    const feedKey = `feed:${userId}`;
    const allPostIds = await this.redisService.zRevRange(feedKey, 0, -1);

    if (allPostIds.length === 0) return;

    const postsToRemove = await this.postRepository.find({
      where: { id: In(allPostIds), user_id: unfollowedUserId },
      select: ['id'],
    });

    if (postsToRemove.length > 0) {
      await this.redisService.zRem(feedKey, ...postsToRemove.map((p) => p.id));
    }
  }

  // ═══════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════

  /**
   * Ensures a user's feed is populated (handles cold start).
   * If the feed has fewer than 5 entries, backfill from DB.
   */
  private async ensureFeedPopulated(userId: string) {
    const feedSize = await this.redisService.zCard(`feed:${userId}`);

    if (feedSize < 5) {
      const followingIds = await this.getFollowingIds(userId);
      if (followingIds.length === 0) return;

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentPosts = await this.postRepository
        .createQueryBuilder('post')
        .where('post.user_id IN (:...ids)', { ids: followingIds })
        .andWhere('post.created_at > :since', { since: sevenDaysAgo })
        .orderBy('post.created_at', 'DESC')
        .take(100)
        .getMany();

      if (recentPosts.length === 0) return;

      const pipeline = this.redisService.getClient().pipeline();
      for (const post of recentPosts) {
        pipeline.zadd(
          `feed:${userId}`,
          new Date(post.created_at).getTime(),
          post.id,
        );
      }
      await pipeline.exec();
    }
  }

  /**
   * Get IDs of users that the given user follows.
   * Cached in Redis (short TTL) and shared with the search feature; invalidated
   * by {@link FeedService.invalidateRelationCache} on follow/unfollow/block.
   */
  private async getFollowingIds(userId: string): Promise<string[]> {
    const cacheKey = `rel:following:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        /* corrupted cache -> fall through to DB */
      }
    }

    const relations = await this.relationRepository.find({
      where: [
        {
          request_side_id: userId,
          relation_type: RelationType.FOLLOWING,
          is_restricted: false,
        },
      ],
      select: ['accept_side_id'],
    });

    const ids = [...new Set(relations.map((r) => r.accept_side_id))];
    await this.redisService.set(
      cacheKey,
      JSON.stringify(ids),
      RELATION_CACHE_TTL,
    );
    return ids;
  }

  /** Get IDs of users blocked by or blocking the given user (Redis cached) */
  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const cacheKey = `rel:blocked:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        /* corrupted cache -> fall through to DB */
      }
    }

    const blocks = await this.relationRepository.find({
      where: [
        { request_side_id: userId, relation_type: RelationType.BLOCK },
        { accept_side_id: userId, relation_type: RelationType.BLOCK },
      ],
      select: ['request_side_id', 'accept_side_id'],
    });

    const ids = [
      ...new Set(
        blocks.map((b) =>
          b.request_side_id === userId ? b.accept_side_id : b.request_side_id,
        ),
      ),
    ];
    await this.redisService.set(
      cacheKey,
      JSON.stringify(ids),
      RELATION_CACHE_TTL,
    );
    return ids;
  }

  /**
   * Invalidate the cached following/blocked IDs for a user.
   * Call after any follow/unfollow/block/unblock so feed & search see fresh data.
   */
  async invalidateRelationCache(userId: string): Promise<void> {
    await this.redisService.del(
      `rel:following:${userId}`,
      `rel:blocked:${userId}`,
      // Personalized Explore ranking depends on the following/blocked sets.
      `explore:ranked:${userId}`,
    );
  }

  /** Get celebrity post IDs that a user should see */
  private async getCelebrityPostIds(
    userId: string,
    maxScore: number | string,
    limit: number,
  ): Promise<string[]> {
    const followingIds = await this.getFollowingIds(userId);
    const celebrityPostIds: string[] = [];

    for (const followedId of followingIds) {
      const isCelebrity = await this.redisService.get(
        `celebrity:${followedId}`,
      );
      if (isCelebrity) {
        const posts = await this.redisService.zRevRangeByScore(
          `celebrity_posts:${followedId}`,
          maxScore,
          '-inf',
          0,
          limit,
        );
        celebrityPostIds.push(...posts);
      }
    }

    return celebrityPostIds;
  }

  /** Batch query posts by IDs with user relation */
  private async getPostsByIds(postIds: string[]): Promise<Post[]> {
    if (postIds.length === 0) return [];

    return this.postRepository.find({
      where: { id: In(postIds) },
      relations: [
        'user',
        'reactions',
        'comments',
        'shared_post',
        'shared_post.user',
        'shared_post.reactions',
        'shared_post.comments',
      ],
      order: { created_at: 'DESC' },
    });
  }

  /** Filter posts based on privacy settings and block status */
  private applyPrivacyFilter(
    posts: Post[],
    userId: string,
    blockedUserIds: string[],
    followingIds: string[],
  ): Post[] {
    return posts.filter((post) => {
      // Skip blocked users
      if (blockedUserIds.includes(post.user_id)) return false;
      if (
        post.shared_post &&
        blockedUserIds.includes(post.shared_post.user?.id)
      )
        return false;

      // Owner can always see their own posts
      if (post.user_id === userId) return true;

      // Privacy check (Post level + User level)
      const isAccountPrivate = post.user?.privacy === PrivacyType.PRIVATE;
      if (isAccountPrivate && !followingIds.includes(post.user_id)) {
        return false;
      }

      // Hide reposts of private accounts if not following the original author
      if (
        post.shared_post &&
        post.shared_post.user?.privacy === PrivacyType.PRIVATE
      ) {
        if (
          post.shared_post.user.id !== userId &&
          !followingIds.includes(post.shared_post.user.id)
        ) {
          return false;
        }
      }

      switch (post.privacy) {
        case PrivacyType.PUBLIC:
          return true;
        case PrivacyType.FOLLOWER:
          return followingIds.includes(post.user_id);
        case PrivacyType.PRIVATE:
          return false;
        default:
          return true;
      }
    });
  }

  private async getViewerRelationStatusMap(
    userId: string,
    authorIds: string[],
  ): Promise<Record<string, RelationType>> {
    const uniqueAuthorIds = [
      ...new Set(authorIds.filter((id): id is string => !!id && id !== userId)),
    ];

    const statuses = uniqueAuthorIds.reduce<Record<string, RelationType>>(
      (acc, id) => {
        acc[id] = RelationType.NONE;
        return acc;
      },
      {},
    );

    if (uniqueAuthorIds.length === 0) return statuses;

    const relations = await this.relationRepository.find({
      where: {
        request_side_id: userId,
        accept_side_id: In(uniqueAuthorIds),
      },
      select: ['accept_side_id', 'relation_type'],
    });

    relations.forEach((relation) => {
      statuses[relation.accept_side_id] =
        relation.relation_type || RelationType.NONE;
    });

    return statuses;
  }

  private withViewerRelation(
    user: any,
    relationStatusMap: Record<string, RelationType>,
    viewerId: string,
  ) {
    if (!user?.id) return user;

    const relationStatus =
      user.id === viewerId
        ? RelationType.NONE
        : relationStatusMap[user.id] || RelationType.NONE;

    return {
      ...user,
      relationStatus,
      isFollowing: relationStatus === RelationType.FOLLOWING,
    };
  }

  /** Enrich posts with interaction counts*/
  private async enrichInteractions(
    posts: Post[],
    userId: string,
  ): Promise<any[]> {
    const authorIds = posts.flatMap((post) => [
      post.user?.id || post.user_id,
      post.shared_post?.user?.id || post.shared_post?.user_id,
    ]);
    const relationStatusMap = await this.getViewerRelationStatusMap(
      userId,
      authorIds,
    );

    // Batch repost data (was N+1: 1 findOne + 1 count per post).
    const actualPostIds = [
      ...new Set(
        posts.map((post) => (post.shared_post ? post.shared_post.id : post.id)),
      ),
    ];
    const repostsCountMap = new Map<string, number>();
    const userRepostedSet = new Set<string>();

    if (actualPostIds.length > 0) {
      const repostCountRows = await this.postRepository
        .createQueryBuilder('p')
        .select('p.shared_post_id', 'sid')
        .addSelect('COUNT(*)', 'cnt')
        .where('p.shared_post_id IN (:...ids)', { ids: actualPostIds })
        .groupBy('p.shared_post_id')
        .getRawMany();
      for (const row of repostCountRows) {
        repostsCountMap.set(row.sid as string, parseInt(row.cnt, 10) || 0);
      }

      const userReposts = await this.postRepository.find({
        where: { user_id: userId, shared_post_id: In(actualPostIds) },
        select: ['shared_post_id'],
      });
      for (const r of userReposts) {
        if (r.shared_post_id) userRepostedSet.add(r.shared_post_id);
      }
    }

    return posts.map((post) => {
      const actualPostId = post.shared_post ? post.shared_post.id : post.id;
      const is_reposted = userRepostedSet.has(actualPostId);
      const repostsCount = repostsCountMap.get(actualPostId) || 0;

      return {
        ...post,
        user: this.withViewerRelation(post.user, relationStatusMap, userId),
        shared_post: post.shared_post
          ? {
              ...post.shared_post,
              user: this.withViewerRelation(
                post.shared_post.user,
                relationStatusMap,
                userId,
              ),
            }
          : post.shared_post,
        reposted_by: (post as any).reposted_by,
        interactions: {
          likes:
            (post.shared_post
              ? post.shared_post.reactions
              : post.reactions
            )?.filter((r: any) => r.reaction === 'like').length || 0,
          comments:
            (post.shared_post ? post.shared_post.comments : post.comments)
              ?.length || 0,
          reposts: repostsCount,
          is_liked:
            (post.shared_post
              ? post.shared_post.reactions
              : post.reactions
            )?.some(
              (r: any) => r.user_id === userId && r.reaction === 'like',
            ) || false,
          is_reposted: is_reposted,
        },
      };
    });
  }
}
