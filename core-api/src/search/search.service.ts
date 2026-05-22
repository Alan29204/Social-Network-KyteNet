import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from 'src/posts/entities/post.entity';
import { User } from 'src/users/entities/user.entity';
import { Relation } from 'src/relations/entities/relation.entity';
import { RelationType } from 'src/helper/relation.enum';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
  ) {}

  /**
   * Search users by username/email using PostgreSQL ILIKE.
   */
  async searchUsers(query: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchTerm = `%${query}%`;

      const [users, total] = await this.userRepository
        .createQueryBuilder('user')
        .where('user.username ILIKE :q', { q: searchTerm })
        .orWhere('user.email ILIKE :q', { q: searchTerm })
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

  /**
   * Search posts by content using PostgreSQL ILIKE.
   * Only returns PUBLIC posts to non-friends.
   */
  async searchPosts(
    query: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;
      const searchTerm = `%${query}%`;

      // Get blocked users
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

  /**
   * Search posts by hashtag.
   */
  async searchByHashtag(
    hashtag: string,
    page: number = 1,
    limit: number = 10,
  ) {
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
   * Combined search: returns both users and posts matching the query.
   */
  async searchAll(query: string, userId: string) {
    const [users, posts] = await Promise.all([
      this.searchUsers(query, 1, 5),
      this.searchPosts(query, userId, 1, 5),
    ]);

    return {
      users: users.data,
      posts: posts.data,
    };
  }
}
