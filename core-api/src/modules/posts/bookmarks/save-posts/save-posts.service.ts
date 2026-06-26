import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavePost } from './entities/save-post.entity';
import { SaveList } from 'src/modules/posts/bookmarks/save-lists/entities/save-list.entity';
import { IUser } from 'src/modules/users/users.interface';

const DEFAULT_LIST_NAME = 'Đã lưu';

@Injectable()
export class SavePostsService {
  constructor(
    @InjectRepository(SavePost)
    private readonly savePostRepository: Repository<SavePost>,
    @InjectRepository(SaveList)
    private readonly saveListRepository: Repository<SaveList>,
  ) {}

  /**
   * Lấy (hoặc tạo nếu chưa có) bộ sưu tập mặc định "Đã lưu" của user.
   * CHỈ dùng ở thao tác GHI (savePost). Các path đọc phải dùng findDefaultList().
   */
  async getOrCreateDefaultList(userId: string): Promise<SaveList> {
    let list = await this.findDefaultList(userId);

    if (!list) {
      list = await this.saveListRepository.save({
        user_id: userId,
        name: DEFAULT_LIST_NAME,
      });
    }

    return list;
  }

  /**
   * Chỉ TÌM bộ sưu tập mặc định (không tạo mới) — tránh tạo "Đã lưu" lúc đọc.
   */
  async findDefaultList(userId: string): Promise<SaveList | null> {
    return this.saveListRepository.findOne({
      where: { user_id: userId, name: DEFAULT_LIST_NAME },
    });
  }

  /**
   * Save a post to a save list.
   * Nếu không truyền saveListId, dùng bộ sưu tập mặc định của user.
   */
  async savePost(user: IUser, postId: string, saveListId?: string) {
    const listId =
      saveListId || (await this.getOrCreateDefaultList(user.id)).id;

    // Check if already saved
    const existing = await this.savePostRepository.findOne({
      where: { post_id: postId, save_list_id: listId },
    });

    if (existing) {
      throw new BadRequestException('Post already saved to this list');
    }

    try {
      await this.savePostRepository.save({
        post_id: postId,
        save_list_id: listId,
      });

      return { message: 'Post saved successfully' };
    } catch {
      throw new InternalServerErrorException('Error saving post');
    }
  }

  /**
   * Remove a saved post.
   * - Có saveListId: bỏ lưu khỏi đúng bộ sưu tập đó.
   * - Không có saveListId: bỏ lưu khỏi TẤT CẢ bộ sưu tập của user (toggle "Bỏ lưu").
   */
  async unsavePost(user: IUser, postId: string, saveListId?: string) {
    let saved: SavePost[];

    if (saveListId) {
      saved = await this.savePostRepository.find({
        where: { post_id: postId, save_list_id: saveListId },
      });
    } else {
      saved = await this.savePostRepository
        .createQueryBuilder('sp')
        .innerJoin('sp.save_list', 'list')
        .where('list.user_id = :userId', { userId: user.id })
        .andWhere('sp.post_id = :postId', { postId })
        .getMany();
    }

    if (saved.length === 0) {
      throw new NotFoundException('Saved post not found');
    }

    try {
      await this.savePostRepository.remove(saved);
      return { message: 'Post unsaved successfully' };
    } catch {
      throw new InternalServerErrorException('Error unsaving post');
    }
  }

  /** Chuẩn hóa 1 bản ghi SavePost -> shape post cho FE. */
  private mapSavedPost(sp: SavePost) {
    return {
      id: sp.id,
      post: {
        ...sp.post,
        isSaved: true,
        interactions: {
          likes:
            sp.post?.reactions?.filter((r) => r.reaction === 'like').length ||
            0,
          comments: sp.post?.comments?.length || 0,
          reposts: 0,
        },
      },
    };
  }

  /**
   * Get all saved posts in a save list with pagination.
   */
  async getSavedPosts(
    saveListId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    try {
      const [savedPosts, total] = await this.savePostRepository.findAndCount({
        where: { save_list_id: saveListId },
        relations: ['post', 'post.user', 'post.reactions', 'post.comments'],
        skip,
        take: limit,
        order: { id: 'DESC' },
      });

      return {
        data: savedPosts.map((sp) => this.mapSavedPost(sp)),
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch {
      throw new InternalServerErrorException('Error fetching saved posts');
    }
  }

  /**
   * "Tất cả đã lưu": hợp nhất bài đã lưu của user qua MỌI bộ sưu tập (distinct theo post).
   * Không tạo list mặc định khi đọc.
   */
  async getMySavedPosts(user: IUser, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    try {
      const totalRaw = await this.savePostRepository
        .createQueryBuilder('sp')
        .innerJoin('sp.save_list', 'list')
        .where('list.user_id = :userId', { userId: user.id })
        .select('COUNT(DISTINCT sp.post_id)', 'cnt')
        .getRawOne<{ cnt: string }>();
      const total = parseInt(totalRaw?.cnt ?? '0', 10);

      if (total === 0) {
        return { data: [], meta: { page, limit, total: 0, total_pages: 0 } };
      }

      // post_id distinct, phân trang
      const idRows = await this.savePostRepository
        .createQueryBuilder('sp')
        .innerJoin('sp.save_list', 'list')
        .where('list.user_id = :userId', { userId: user.id })
        .select('sp.post_id', 'post_id')
        .addSelect('MAX(sp.id)', 'max_id')
        .groupBy('sp.post_id')
        .orderBy('max_id', 'DESC')
        .offset(skip)
        .limit(limit)
        .getRawMany<{ post_id: string }>();
      const postIds = idRows.map((r) => r.post_id);

      const rows = await this.savePostRepository
        .createQueryBuilder('sp')
        .innerJoinAndSelect('sp.post', 'post')
        .leftJoinAndSelect('post.user', 'user')
        .leftJoinAndSelect('post.reactions', 'reactions')
        .leftJoinAndSelect('post.comments', 'comments')
        .innerJoin('sp.save_list', 'list')
        .where('list.user_id = :userId', { userId: user.id })
        .andWhere('sp.post_id IN (:...postIds)', { postIds })
        .getMany();

      // Dedupe theo post_id, giữ đúng thứ tự phân trang
      const byPost = new Map<string, SavePost>();
      for (const r of rows) {
        if (!byPost.has(r.post_id)) byPost.set(r.post_id, r);
      }
      const ordered = postIds
        .map((id) => byPost.get(id))
        .filter((sp): sp is SavePost => !!sp);

      return {
        data: ordered.map((sp) => this.mapSavedPost(sp)),
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    } catch {
      throw new InternalServerErrorException('Error fetching saved posts');
    }
  }

  /**
   * Lấy danh sách post_id đã lưu (mặc định) để FE đánh dấu nhanh trạng thái.
   */
  async getMySavedPostIds(user: IUser): Promise<string[]> {
    const list = await this.findDefaultList(user.id);
    if (!list) return [];
    const saved = await this.savePostRepository.find({
      where: { save_list_id: list.id },
      select: ['post_id'],
    });
    return saved.map((s) => s.post_id);
  }

  /**
   * Trả về Set post_id đã được user lưu trong BẤT KỲ bộ sưu tập nào.
   * Dùng để feed/post đánh dấu trạng thái isSaved.
   */
  async getSavedPostIdsAllLists(
    userId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    if (!userId || postIds.length === 0) return new Set();
    const rows = await this.savePostRepository
      .createQueryBuilder('sp')
      .innerJoin('sp.save_list', 'list')
      .where('list.user_id = :userId', { userId })
      .andWhere('sp.post_id IN (:...postIds)', { postIds })
      .select('sp.post_id', 'post_id')
      .getRawMany<{ post_id: string }>();
    return new Set(rows.map((r) => r.post_id));
  }

  /**
   * Check if a post is saved by the user in any list.
   */
  async isPostSaved(postId: string, saveListId: string): Promise<boolean> {
    const saved = await this.savePostRepository.findOne({
      where: { post_id: postId, save_list_id: saveListId },
    });
    return !!saved;
  }
}
