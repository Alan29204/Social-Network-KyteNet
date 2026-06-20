import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Post } from 'src/modules/posts/entities/post.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { RelationType } from 'src/common/enums/relation.enum';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { buildHashtagSearchTerms } from 'src/common/utils/searchableText';
import { PrivacyType } from 'src/common/enums/privacy.enum';

@Injectable()
export class SearchService {
  private readonly aiServiceUrl: string;
  private readonly aiServiceKey: string;

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
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

  /** Header dùng cho các call nội bộ tới ai-services. */
  private get aiHeaders() {
    return { key_auth: this.aiServiceKey };
  }

  /** Lấy danh sách id user bị chặn (2 chiều) với `userId`. */
  private async getBlockedUserIds(userId?: string): Promise<string[]> {
    if (!userId) return [];
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

  private async getFollowingIds(userId?: string): Promise<string[]> {
    if (!userId) return [];
    const followingRelations = await this.relationRepository.find({
      where: {
        request_side_id: userId,
        relation_type: RelationType.FOLLOWING,
        is_restricted: false,
      },
      select: ['accept_side_id'],
    });

    return [...new Set(followingRelations.map((r) => r.accept_side_id))];
  }

  private getHashtagMatchSql(alias: string = 'post'): string {
    return `
      EXISTS (
        SELECT 1
        FROM unnest(${alias}.hashtags) AS tag(value)
        WHERE LOWER(tag.value) IN (:...hashtagTerms)
          OR LOWER(regexp_replace(tag.value, '[^[:alnum:]]', '', 'g')) IN (:...hashtagTerms)
      )
    `;
  }

  private applyPostSearchVisibility(
    qb: SelectQueryBuilder<Post>,
    userId: string,
    blockedIds: string[],
    followingIds: string[],
  ) {
    if (blockedIds.length > 0) {
      qb.andWhere('post.user_id NOT IN (:...blockedIds)', { blockedIds });
    }

    if (followingIds.length > 0) {
      qb.andWhere(
        '(user.privacy = :pub OR post.user_id = :currentUserId OR post.user_id IN (:...followingIds))',
        {
          pub: PrivacyType.PUBLIC,
          currentUserId: userId,
          followingIds,
        },
      );
    } else {
      qb.andWhere('(user.privacy = :pub OR post.user_id = :currentUserId)', {
        pub: PrivacyType.PUBLIC,
        currentUserId: userId,
      });
    }
  }

  private filterVisibleHydratedPosts(
    posts: Post[],
    userId: string,
    blockedIds: string[],
    followingIds: string[],
  ): Post[] {
    return posts.filter((post) => {
      if (blockedIds.includes(post.user_id)) return false;
      if (post.shared_post_id || post.shared_post) return false;
      if (post.privacy !== PrivacyType.PUBLIC) return false;

      const isAccountPrivate = post.user?.privacy === PrivacyType.PRIVATE;
      if (
        isAccountPrivate &&
        post.user_id !== userId &&
        !followingIds.includes(post.user_id)
      ) {
        return false;
      }

      return true;
    });
  }

  private sortByPostIds(posts: Post[], postIds: string[]): Post[] {
    const orderMap = new Map(postIds.map((id, idx) => [id, idx]));
    return posts.sort(
      (a, b) =>
        (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  /** Search users by username/email using PostgreSQL ILIKE. */
  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ) {
    try {
      const skip = (page - 1) * limit;
      const searchTerm = `%${query}%`;

      // Absolute Override: loại trừ user bị chặn khỏi kết quả tìm kiếm
      const blockedIds = await this.getBlockedUserIds(userId);

      const qb = this.userRepository
        .createQueryBuilder('user')
        .where('(user.username ILIKE :q OR user.full_name ILIKE :q)', {
          q: searchTerm,
        });

      if (blockedIds.length > 0) {
        qb.andWhere('user.id NOT IN (:...blocked)', { blocked: blockedIds });
      }



      const [users, total] = await qb
        .select([
          'user.id',
          'user.username',
          'user.full_name',
          'user.avatar',
          'user.privacy',
        ])
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        data: users,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    } catch {
      throw new InternalServerErrorException('Error searching users');
    }
  }

  /** Search posts by content or hashtag. Only returns visible public posts. */
  async searchPosts(
    query: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;
      const cleanQuery = query?.trim() || '';
      const searchTerm = `%${cleanQuery}%`;
      const hashtagTerms = buildHashtagSearchTerms(cleanQuery);
      const blockedIds = await this.getBlockedUserIds(userId);
      const followingIds = await this.getFollowingIds(userId);

      const qb = this.postRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.user', 'user')
        .where(
          new Brackets((whereQb) => {
            whereQb.where('post.content ILIKE :q', { q: searchTerm });
            if (hashtagTerms.length > 0) {
              whereQb.orWhere(this.getHashtagMatchSql('post'), {
                hashtagTerms,
              });
            }
          }),
        )
        .andWhere('post.privacy = :privacy', {
          privacy: PrivacyType.PUBLIC,
        })
        .andWhere('post.shared_post_id IS NULL');

      this.applyPostSearchVisibility(qb, userId, blockedIds, followingIds);

      const [posts, total] = await qb
        .orderBy('post.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        data: posts,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.warn('[Search] Error searching posts:', (error as Error)?.message);
      throw new InternalServerErrorException('Error searching posts');
    }
  }

  /** Search posts by hashtag. */
  async searchByHashtag(
    hashtag: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;
      const hashtagTerms = buildHashtagSearchTerms(hashtag);
      if (hashtagTerms.length === 0) {
        return {
          data: [],
          meta: { page, limit, total: 0, total_pages: 0 },
        };
      }

      const blockedIds = await this.getBlockedUserIds(userId);
      const followingIds = await this.getFollowingIds(userId);

      const qb = this.postRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.user', 'user')
        .where('post.privacy = :privacy', { privacy: PrivacyType.PUBLIC })
        .andWhere(this.getHashtagMatchSql('post'), { hashtagTerms })
        .andWhere('post.shared_post_id IS NULL');

      this.applyPostSearchVisibility(qb, userId, blockedIds, followingIds);

      const [posts, total] = await qb
        .orderBy('post.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        data: posts,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.warn(
        '[Search] Error searching by hashtag:',
        (error as Error)?.message,
      );
      throw new InternalServerErrorException('Error searching by hashtag');
    }
  }

  /**
   * Semantic search using AI service (ChromaDB vector similarity).
   * Falls back to ILIKE keyword search if AI service is unavailable.
   */
  async semanticSearchPosts(
    query: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const response = await axios.get(
        `${this.aiServiceUrl}/posts/semantic-search`,
        {
          params: { q: query, page, page_size: limit },
          headers: this.aiHeaders,
          timeout: 5000,
        },
      );

      const postIds: string[] = response.data?.post_ids || [];

      if (postIds.length === 0) {
        return {
          data: [],
          meta: { page, limit, total: 0, total_pages: 0, source: 'semantic' },
          source: 'semantic',
        };
      }

      const blockedIds = await this.getBlockedUserIds(userId);
      const followingIds = await this.getFollowingIds(userId);

      let posts = await this.postRepository.find({
        where: {
          id: In(postIds),
          privacy: PrivacyType.PUBLIC,
          shared_post_id: IsNull(),
        },
        relations: ['user'],
      });

      posts = this.filterVisibleHydratedPosts(
        posts,
        userId,
        blockedIds,
        followingIds,
      );
      posts = this.sortByPostIds(posts, postIds);

      return {
        data: posts,
        meta: {
          page,
          limit,
          total: posts.length,
          total_pages: Math.ceil(posts.length / limit),
          source: 'semantic',
        },
        source: 'semantic',
      };
    } catch (error) {
      console.warn(
        '[Search] AI service unavailable, falling back to ILIKE:',
        (error as Error)?.message,
      );
      const fallback = await this.searchPosts(query, userId, page, limit);
      return {
        ...fallback,
        meta: { ...fallback.meta, source: 'keyword_fallback' },
        source: 'keyword_fallback',
      };
    }
  }

  /** Combined search: returns both users and posts matching the query. */
  async searchAll(query: string, userId: string) {
    const [users, posts] = await Promise.all([
      this.searchUsers(query, 1, 5, userId),
      this.searchPosts(query, userId, 1, 5),
    ]);
    return { users: users.data, posts: posts.data };
  }

  /** Xóa embedding của bài viết khỏi ChromaDB (gọi khi xóa bài). */
  async deletePostEmbedding(postId: string): Promise<void> {
    try {
      await axios.delete(`${this.aiServiceUrl}/posts/embed/${postId}`, {
        headers: this.aiHeaders,
        timeout: 5000,
      });
    } catch (error) {
      console.warn(
        `[Embedding] Failed to delete embedding for post ${postId}:`,
        (error as Error)?.message,
      );
    }
  }
}
