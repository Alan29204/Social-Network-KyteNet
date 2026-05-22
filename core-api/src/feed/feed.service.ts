import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Post } from 'src/posts/entities/post.entity';
import { Relation } from 'src/relations/entities/relation.entity';
import { RedisService } from 'src/redis/redis.service';
import { RelationType } from 'src/helper/relation.enum';
import { PrivacyType } from 'src/helper/privacy.enum';

/** Maximum number of posts stored in each user's Redis feed */
const MAX_FEED_SIZE = 500;
/** Follower count threshold to classify a user as "celebrity" (Fan-out on Read) */
const CELEBRITY_THRESHOLD = 1000;

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
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
      const friendIds = await this.getFriendIds(userId);
      const filteredPosts = this.applyPrivacyFilter(
        posts,
        userId,
        blockedUserIds,
        friendIds,
      );

      // 5. Sort by created_at DESC and take limit
      filteredPosts.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const result = filteredPosts.slice(0, limit);

      // 6. Enrich with interaction data
      const enriched = this.enrichInteractions(result, userId);

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

      const query = this.postRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.user', 'user')
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
      }

      if (cursor) {
        query.andWhere('post.created_at < :cursor', {
          cursor: new Date(cursor),
        });
      }

      const rawPosts = await query
        .addSelect(
          `(COUNT(DISTINCT reaction.id) * 2 + COUNT(DISTINCT comment.id) * 3) - (EXTRACT(EPOCH FROM (NOW() - post.created_at)) / 3600 * 0.5)`,
          'engagement_score',
        )
        .groupBy('post.id')
        .addGroupBy('user.id')
        .orderBy('engagement_score', 'DESC')
        .take(limit)
        .getMany();

      // Enrich with interactions
      const enriched = this.enrichInteractions(rawPosts, userId);

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

    // Get all follower IDs (users who follow this author)
    const followers = await this.relationRepository.find({
      where: [
        { accept_side_id: authorId, relation_type: RelationType.FOLLOWING },
        { accept_side_id: authorId, relation_type: RelationType.FRIEND },
      ],
      select: ['request_side_id'],
    });
    // Also add reverse-direction friends
    const reverseFollowers = await this.relationRepository.find({
      where: [
        { request_side_id: authorId, relation_type: RelationType.FRIEND },
      ],
      select: ['accept_side_id'],
    });

    const followerIds = [
      ...new Set([
        ...followers.map((f) => f.request_side_id),
        ...reverseFollowers.map((f) => f.accept_side_id),
      ]),
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
        { accept_side_id: authorId, relation_type: RelationType.FRIEND },
        { request_side_id: authorId, relation_type: RelationType.FRIEND },
      ],
      select: ['request_side_id', 'accept_side_id'],
    });

    const followerIds = [
      ...new Set(
        followers.map((f) =>
          f.request_side_id === authorId ? f.accept_side_id : f.request_side_id,
        ),
      ),
    ];

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

  /** Get IDs of users that the given user follows or is friends with */
  private async getFollowingIds(userId: string): Promise<string[]> {
    const relations = await this.relationRepository.find({
      where: [
        { request_side_id: userId, relation_type: RelationType.FOLLOWING },
        { request_side_id: userId, relation_type: RelationType.FRIEND },
        { accept_side_id: userId, relation_type: RelationType.FRIEND },
      ],
      select: ['request_side_id', 'accept_side_id'],
    });

    return [
      ...new Set(
        relations.map((r) =>
          r.request_side_id === userId ? r.accept_side_id : r.request_side_id,
        ),
      ),
    ];
  }

  /** Get IDs of users that are friends with the given user */
  private async getFriendIds(userId: string): Promise<string[]> {
    const relations = await this.relationRepository.find({
      where: [
        { request_side_id: userId, relation_type: RelationType.FRIEND },
        { accept_side_id: userId, relation_type: RelationType.FRIEND },
      ],
      select: ['request_side_id', 'accept_side_id'],
    });

    return [
      ...new Set(
        relations.map((r) =>
          r.request_side_id === userId ? r.accept_side_id : r.request_side_id,
        ),
      ),
    ];
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
      relations: ['user', 'reactions', 'comments'],
      order: { created_at: 'DESC' },
    });
  }

  /** Filter posts based on privacy settings and block status */
  private applyPrivacyFilter(
    posts: Post[],
    userId: string,
    blockedUserIds: string[],
    friendIds: string[],
  ): Post[] {
    return posts.filter((post) => {
      // Skip blocked users
      if (blockedUserIds.includes(post.user_id)) return false;

      // Owner can always see their own posts
      if (post.user_id === userId) return true;

      // Privacy check
      switch (post.privacy) {
        case PrivacyType.PUBLIC:
          return true;
        case PrivacyType.FRIEND:
          return friendIds.includes(post.user_id);
        case PrivacyType.PRIVATE:
          return false;
        default:
          return true;
      }
    });
  }

  /** Enrich posts with interaction counts*/
  private enrichInteractions(posts: Post[], userId: string): any[] {
    return posts.map((post) => ({
      ...post,
      interactions: {
        likes: post.reactions?.filter((r) => r.reaction === 'like').length || 0,
        comments: post.comments?.length || 0,
        reposts: 0,
        is_liked:
          post.reactions?.some(
            (r) => r.user_id === userId && r.reaction === 'like',
          ) || false,
      },
    }));
  }
}
