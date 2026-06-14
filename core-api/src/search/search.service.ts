import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Post } from 'src/modules/posts/entities/post.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { RelationType } from 'src/common/enums/relation.enum';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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
    return blocks.map((b) =>
      b.request_side_id === userId ? b.accept_side_id : b.request_side_id,
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
        .where('(user.username ILIKE :q OR user.email ILIKE :q)', {
          q: searchTerm,
        });

      if (blockedIds.length > 0) {
        qb.andWhere('user.id NOT IN (:...blockedIds)', { blockedIds });
      }

      const [users, total] = await qb
        .select([
          'user.id',
          'user.username',
          'user.email',
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

  /** Search posts by content using PostgreSQL ILIKE. Only returns PUBLIC posts. */
  async searchPosts(
    query: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;
      const searchTerm = `%${query}%`;

      const blocks = await this.relationRepository.find({
        where: [
          { request_side_id: userId, relation_type: RelationType.BLOCK },
          { accept_side_id: userId, relation_type: RelationType.BLOCK },
        ],
        select: ['request_side_id', 'accept_side_id'],
      });

      const blockedIds = blocks.map((b) =>
        b.request_side_id === userId ? b.accept_side_id : b.request_side_id,
      );

      const qb = this.postRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.user', 'user')
        .where('post.content ILIKE :q', { q: searchTerm })
        .andWhere('post.privacy = :privacy', { privacy: 'public' });

      if (blockedIds.length > 0) {
        qb.andWhere('post.user_id NOT IN (:...blocked)', {
          blocked: blockedIds,
        });
      }

      const [posts, total] = await qb
        .orderBy('post.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        data: posts,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    } catch {
      throw new InternalServerErrorException('Error searching posts');
    }
  }

  /** Search posts by hashtag. */
  async searchByHashtag(hashtag: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      const tag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;

      const [posts, total] = await this.postRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.user', 'user')
        .where('post.privacy = :privacy', { privacy: 'public' })
        .andWhere(':tag = ANY(post.hashtags)', { tag })
        .orderBy('post.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        data: posts,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    } catch {
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
          meta: { page, limit, total: 0, total_pages: 0 },
          source: 'semantic',
        };
      }

      const posts = await this.postRepository.find({
        where: { id: In(postIds), privacy: 'public' as any },
        relations: ['user'],
        order: { created_at: 'DESC' },
      });

      return {
        data: posts,
        meta: {
          page,
          limit,
          total: response.data?.pagination?.total_results || posts.length,
          total_pages: response.data?.pagination?.total_pages || 1,
        },
        source: 'semantic',
      };
    } catch (error) {
      console.warn(
        '[Search] AI service unavailable, falling back to ILIKE:',
        (error as Error)?.message,
      );
      const fallback = await this.searchPosts(query, userId, page, limit);
      return { ...fallback, source: 'keyword_fallback' };
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

  /**
   * Gợi ý bài viết cá nhân hóa qua AI service (ChromaDB).
   * Trả về danh sách bài đã hydrate từ Postgres, giữ đúng thứ tự xếp hạng của AI.
   * Trả về data rỗng khi AI không có gợi ý (caller sẽ fallback feed mặc định).
   */
  async getRecommendedPosts(userId: string, limit: number = 20) {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/posts/recommend`,
        { user_id: userId, limit },
        { headers: this.aiHeaders, timeout: 8000 },
      );

      const postIds: string[] = response.data?.post_ids || [];
      const source: string = response.data?.source || 'personalized';

      if (postIds.length === 0) {
        return { data: [], source };
      }

      const posts = await this.postRepository.find({
        where: { id: In(postIds), privacy: 'public' as any },
        relations: ['user'],
      });

      // Giữ đúng thứ tự xếp hạng do AI trả về
      const orderMap = new Map(postIds.map((id, idx) => [id, idx]));
      posts.sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );

      return { data: posts, source };
    } catch (error) {
      console.warn(
        '[Recommend] AI service unavailable:',
        (error as Error)?.message,
      );
      return { data: [], source: 'unavailable' };
    }
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
