import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Post } from 'src/modules/posts/entities/post.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { RedisService } from 'src/infra/redis/redis.service';
import { RelationType } from 'src/common/enums/relation.enum';
import { PrivacyType } from 'src/common/enums/privacy.enum';

/** Maximum number of posts stored in each user's Redis feed */
const MAX_FEED_SIZE = 500;
/** Follower count threshold to classify a user as "celebrity" (Fan-out on Read) */
const CELEBRITY_THRESHOLD = 1000;

@Injectable()
export class FeedService {
  private readonly aiServiceUrl: string;
  private readonly aiServiceKey: string;

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
    this.aiServiceKey = this.configService.get<string>(
      'AI_SERVICE_KEY',
      'key_auth',
    );
  }

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
   * Gets the "For You" feed — public posts ranked by engagement score.
   * Uses Fan-out on Read with weighted scoring:
   *   score = (likes × 2) + (comments × 3) - (age_hours × 0.5)
   *
   * @param userId - Current user ID
   * @param cursor - Timestamp cursor for pagination
   * @param limit - Number of posts to return
   */
  async getForYouFeed(userId: string, cursor?: number, limit: number = 10) {
    try {
      const blockedUserIds = await this.getBlockedUserIds(userId);
      const followingIds = await this.getFollowingIds(userId);

      const query = this.postRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.user', 'user')
        .leftJoinAndSelect('post.shared_post', 'shared_post')
        .leftJoinAndSelect('shared_post.user', 'shared_post_user')
        .leftJoin('post.reactions', 'reaction')
        .leftJoin('post.comments', 'comment')
        .addSelect('COUNT(DISTINCT reaction.id)', 'like_count')
        .addSelect('COUNT(DISTINCT comment.id)', 'comment_count')
        .where('post.privacy = :privacy', { privacy: PrivacyType.PUBLIC })
        .andWhere('post.user_id != :userId', { userId });

      if (blockedUserIds.length > 0) {
        query.andWhere('post.user_id NOT IN (:...blocked)', {
          blocked: blockedUserIds,
        });
        query.andWhere(
          '(shared_post_user.id IS NULL OR shared_post_user.id NOT IN (:...blocked))',
          { blocked: blockedUserIds },
        );
      }

      if (followingIds.length > 0) {
        query.andWhere('post.user_id NOT IN (:...followingIds)', {
          followingIds,
        });
        query.andWhere(
          '(shared_post_user.id IS NULL OR shared_post_user.id NOT IN (:...followingIds))',
          { followingIds },
        );
      }

      if (cursor) {
        query.andWhere('post.created_at < :cursor', {
          cursor: new Date(cursor),
        });
      }

      let rawPosts = await query
        .addSelect(
          `(COUNT(DISTINCT reaction.id) * 2 + COUNT(DISTINCT comment.id) * 3) - (EXTRACT(EPOCH FROM (NOW() - post.created_at)) / 3600 * 0.5)`,
          'engagement_score',
        )
        .groupBy('post.id')
        .addGroupBy('user.id')
        .addGroupBy('shared_post.id')
        .addGroupBy('shared_post_user.id')
        .orderBy('engagement_score', 'DESC')
        .take(limit)
        .getMany();

      // Deduplicate original posts and aggregate reposters
      const seenOriginalsForYou = new Map<string, any>();
      rawPosts.forEach((p: any) => {
        const originalId = p.shared_post_id || p.id;

        if (!seenOriginalsForYou.has(originalId)) {
          if (p.shared_post_id) {
            p.reposted_by = [{ id: p.user.id, username: p.user.username }];
          }
          seenOriginalsForYou.set(originalId, p);
        } else {
          const keptPost = seenOriginalsForYou.get(originalId);
          if (p.shared_post_id && keptPost.shared_post_id) {
            if (!keptPost.reposted_by.some((u: any) => u.id === p.user.id)) {
              keptPost.reposted_by.push({
                id: p.user.id,
                username: p.user.username,
              });
            }
          }
        }
      });
      rawPosts = Array.from(seenOriginalsForYou.values());

      // Enrich with interactions
      const enriched = await this.enrichInteractions(rawPosts, userId);

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
      console.error('Error fetching for-you feed:', error);
      throw new InternalServerErrorException('Error fetching feed');
    }
  }

  /**
   * Gợi ý cá nhân hóa qua AI (ChromaDB): lấy danh sách post_ids đã xếp hạng
   * theo sở thích người dùng, hydrate + enrich.
   * Nếu AI không có gợi ý (người dùng mới / AI sập) -> fallback "For You".
   *
   * @param userId - Current user ID
   * @param limit - Số bài muốn lấy
   */
  async getRecommendedFeed(userId: string, limit: number = 10) {
    try {
      let postIds: string[] = [];
      let source = 'personalized';

      try {
        const response = await axios.post(
          `${this.aiServiceUrl}/posts/recommend`,
          { user_id: userId, limit },
          { headers: { key_auth: this.aiServiceKey }, timeout: 8000 },
        );
        postIds = response.data?.post_ids || [];
        source = response.data?.source || 'personalized';
      } catch (err) {
        console.warn(
          '[Recommend] AI service unavailable, fallback to ForYou:',
          (err as Error)?.message,
        );
      }

      // Không có gợi ý -> dùng feed "For You" mặc định
      if (postIds.length === 0) {
        const fallback = await this.getForYouFeed(userId, undefined, limit);
        return {
          ...fallback,
          meta: { ...fallback.meta, source: 'foryou_fallback' },
        };
      }

      // Loại bài của người bị chặn
      const blockedUserIds = await this.getBlockedUserIds(userId);

      const posts = await this.getPostsByIds(postIds);
      const visible = posts.filter(
        (p) =>
          p.privacy === PrivacyType.PUBLIC &&
          !blockedUserIds.includes(p.user_id) &&
          !(p.shared_post && blockedUserIds.includes(p.shared_post.user?.id)),
      );

      // Giữ đúng thứ tự xếp hạng AI trả về
      const orderMap = new Map(postIds.map((id, idx) => [id, idx]));
      visible.sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );

      const enriched = await this.enrichInteractions(visible, userId);

      return {
        data: enriched,
        meta: { next_cursor: null, has_more: false, source },
      };
    } catch (error) {
      console.error('Error fetching recommended feed:', error);
      throw new InternalServerErrorException('Error fetching recommended feed');
    }
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

    // Always add to author's own feed
    await this.redisService.zAdd(`feed:${authorId}`, timestamp, postId);
    await this.redisService.zRemRangeByRank(
      `feed:${authorId}`,
      0,
      -(MAX_FEED_SIZE + 1),
    );
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

  /** Get IDs of users that the given user follows */
  private async getFollowingIds(userId: string): Promise<string[]> {
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

    return [...new Set(relations.map((r) => r.accept_side_id))];
  }

  /** Get IDs of users blocked by or blocking the given user */
  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.relationRepository.find({
      where: [
        { request_side_id: userId, relation_type: RelationType.BLOCK },
        { accept_side_id: userId, relation_type: RelationType.BLOCK },
      ],
      select: ['request_side_id', 'accept_side_id'],
    });

    return [
      ...new Set(
        blocks.map((b) =>
          b.request_side_id === userId ? b.accept_side_id : b.request_side_id,
        ),
      ),
    ];
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
      if (post.shared_post && blockedUserIds.includes(post.shared_post.user?.id)) return false;

      // Owner can always see their own posts
      if (post.user_id === userId) return true;

      // Privacy check
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

  /** Enrich posts with interaction counts*/
  private async enrichInteractions(
    posts: Post[],
    userId: string,
  ): Promise<any[]> {
    return Promise.all(
      posts.map(async (post) => {
        const actualPostId = post.shared_post ? post.shared_post.id : post.id;
        const is_reposted = !!(await this.postRepository.findOne({
          where: { user_id: userId, shared_post_id: actualPostId },
        }));
        const repostsCount = await this.postRepository.count({
          where: { shared_post_id: actualPostId },
        });

        return {
          ...post,
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
      }),
    );
  }
}
