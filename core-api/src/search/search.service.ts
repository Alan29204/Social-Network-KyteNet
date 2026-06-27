import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Post } from 'src/modules/posts/entities/post.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { RelationType } from 'src/common/enums/relation.enum';
import { PrivacyType } from 'src/common/enums/privacy.enum';
import { RedisService } from 'src/infra/redis/redis.service';

/** TTL (seconds) for cached following/blocked relation ID lists (shared with feed) */
const RELATION_CACHE_TTL = 60;

@Injectable()
export class SearchService {
  /** Memoized: whether the `f_unaccent` helper (unaccent + pg_trgm) is available. */
  private unaccentReady?: boolean;

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Kiểm tra (một lần, memo) xem hàm `f_unaccent` đã tồn tại chưa. Nếu chưa
   * (extension/bootstrap không chạy được ở môi trường nào đó), tìm kiếm sẽ
   * degrade về `lower() ILIKE` + sắp theo thời gian thay vì lỗi.
   */
  private async isUnaccentReady(): Promise<boolean> {
    if (this.unaccentReady !== undefined) return this.unaccentReady;
    try {
      // Probe trực tiếp: gọi được hàm nghĩa là extension + bootstrap đã sẵn sàng.
      await this.postRepository.query("SELECT f_unaccent('x')");
      this.unaccentReady = true;
    } catch {
      this.unaccentReady = false;
    }
    return this.unaccentReady;
  }

  /**
   * Lấy danh sách id user bị chặn (2 chiều) với `userId`.
   * Cache Redis (`rel:blocked:{uid}`) dùng chung với Feed; được FeedService
   * invalidate khi có thay đổi quan hệ (follow/block).
   */
  private async getBlockedUserIds(userId?: string): Promise<string[]> {
    if (!userId) return [];
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
    await this.redisService.set(cacheKey, JSON.stringify(ids), RELATION_CACHE_TTL);
    return ids;
  }

  /** Lấy danh sách id user đang theo dõi (Redis cached, key `rel:following:{uid}`). */
  private async getFollowingIds(userId?: string): Promise<string[]> {
    if (!userId) return [];
    const cacheKey = `rel:following:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        /* corrupted cache -> fall through to DB */
      }
    }

    const followingRelations = await this.relationRepository.find({
      where: {
        request_side_id: userId,
        relation_type: RelationType.FOLLOWING,
        is_restricted: false,
      },
      select: ['accept_side_id'],
    });

    const ids = [...new Set(followingRelations.map((r) => r.accept_side_id))];
    await this.redisService.set(cacheKey, JSON.stringify(ids), RELATION_CACHE_TTL);
    return ids;
  }

  /**
   * SQL khớp hashtag kiểu chuỗi con (substring), không dấu khi `ready`.
   * Dùng tham số `:hashtagLike` (pattern `%term%`) tạo bởi {@link buildHashtagLike}.
   */
  private getHashtagMatchSql(ready: boolean): string {
    const left = ready ? 'f_unaccent(lower(tag.value))' : 'lower(tag.value)';
    const right = ready ? 'f_unaccent(:hashtagLike)' : ':hashtagLike';
    return `
      EXISTS (
        SELECT 1
        FROM unnest(post.hashtags) AS tag(value)
        WHERE ${left} ILIKE ${right}
      )
    `;
  }

  /** Dựng pattern ILIKE cho hashtag (bỏ #, bỏ dấu cách, escape ký tự đặc biệt). */
  private buildHashtagLike(query: string): string | null {
    const clean = query
      .replace(/^#/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    if (!clean) return null;
    return `%${clean.replace(/[\\%_]/g, '\\$&')}%`;
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

  private sortByPostIds(posts: Post[], postIds: string[]): Post[] {
    const orderMap = new Map(postIds.map((id, idx) => [id, idx]));
    return posts.sort(
      (a, b) =>
        (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  /**
   * Search users by username/full_name — accent-insensitive (Vietnamese) via
   * `f_unaccent` + `pg_trgm`, ranked by trigram similarity (most relevant first).
   * Degrades to `lower() ILIKE` + alphabetical order if `f_unaccent` is absent.
   */
  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ) {
    try {
      const skip = (page - 1) * limit;
      const term = (query || '').trim().toLowerCase();
      const likeTerm = `%${term}%`;
      const ready = await this.isUnaccentReady();

      const matchSql = ready
        ? '(f_unaccent(lower(user.username)) ILIKE f_unaccent(:like) OR f_unaccent(lower(user.full_name)) ILIKE f_unaccent(:like))'
        : '(lower(user.username) ILIKE :like OR lower(user.full_name) ILIKE :like)';
      const relevanceSql = ready
        ? "GREATEST(similarity(f_unaccent(lower(user.username)), f_unaccent(:term)), similarity(f_unaccent(lower(COALESCE(user.full_name, ''))), f_unaccent(:term)))"
        : '0';

      // Absolute Override: loại trừ user bị chặn khỏi kết quả tìm kiếm
      const blockedIds = await this.getBlockedUserIds(userId);

      const qb = this.userRepository
        .createQueryBuilder('user')
        .where(matchSql, { like: likeTerm })
        .setParameter('term', term);

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
        // Order by relevance alias (no dotted raw expression -> TypeORM-safe)
        .addSelect(relevanceSql, 'relevance')
        .orderBy('relevance', 'DESC')
        .addOrderBy('user.username', 'ASC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        data: users,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.warn('[Search] Error searching users:', (error as Error)?.message);
      throw new InternalServerErrorException('Error searching users');
    }
  }

  /**
   * Search posts by content (accent-insensitive) or hashtag, ranked by relevance.
   * Two-step query (rank IDs -> hydrate) to avoid TypeORM's join+pagination
   * machinery choking on a raw ORDER BY expression.
   */
  async searchPosts(
    query: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;
      const cleanQuery = query?.trim() || '';
      const term = cleanQuery.toLowerCase();
      const likeTerm = `%${term}%`;
      const hashtagLike = this.buildHashtagLike(cleanQuery);
      const ready = await this.isUnaccentReady();
      const blockedIds = await this.getBlockedUserIds(userId);
      const followingIds = await this.getFollowingIds(userId);

      const contentMatchSql = ready
        ? 'f_unaccent(lower(post.content)) ILIKE f_unaccent(:like)'
        : 'lower(post.content) ILIKE :like';
      const relevanceSql = ready
        ? "similarity(f_unaccent(lower(COALESCE(post.content, ''))), f_unaccent(:term))"
        : '0';

      // ── Step A: rank matching post IDs (raw, no entity join-pagination) ──
      const idQb = this.postRepository
        .createQueryBuilder('post')
        .leftJoin('post.user', 'user') // join (no select) for visibility checks
        .select('post.id', 'id')
        .where(
          new Brackets((whereQb) => {
            whereQb.where(contentMatchSql, { like: likeTerm });
            if (hashtagLike) {
              whereQb.orWhere(this.getHashtagMatchSql(ready), { hashtagLike });
            }
          }),
        )
        .andWhere('post.privacy = :privacy', { privacy: PrivacyType.PUBLIC })
        .andWhere('post.shared_post_id IS NULL')
        .setParameter('term', term);

      this.applyPostSearchVisibility(idQb, userId, blockedIds, followingIds);

      const total = await idQb.getCount();

      const rankedRows = await idQb
        .addSelect(relevanceSql, 'relevance')
        .orderBy('relevance', 'DESC')
        .addOrderBy('post.created_at', 'DESC')
        .limit(limit)
        .offset(skip)
        .getRawMany();

      const ids = rankedRows.map((r) => r.id as string);
      if (ids.length === 0) {
        return {
          data: [],
          meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
        };
      }

      // ── Step B: hydrate posts + restore ranking order ──
      const posts = await this.postRepository.find({
        where: { id: In(ids) },
        relations: ['user'],
      });
      const ordered = this.sortByPostIds(posts, ids);

      return {
        data: ordered,
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
      const hashtagLike = this.buildHashtagLike(hashtag);
      if (!hashtagLike) {
        return {
          data: [],
          meta: { page, limit, total: 0, total_pages: 0 },
        };
      }

      const ready = await this.isUnaccentReady();
      const blockedIds = await this.getBlockedUserIds(userId);
      const followingIds = await this.getFollowingIds(userId);

      const qb = this.postRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.user', 'user')
        .where('post.privacy = :privacy', { privacy: PrivacyType.PUBLIC })
        .andWhere(this.getHashtagMatchSql(ready), { hashtagLike })
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

  /** Combined search: returns both users and posts matching the query. */
  async searchAll(query: string, userId: string) {
    const [users, posts] = await Promise.all([
      this.searchUsers(query, 1, 5, userId),
      this.searchPosts(query, userId, 1, 5),
    ]);
    return { users: users.data, posts: posts.data };
  }
}
