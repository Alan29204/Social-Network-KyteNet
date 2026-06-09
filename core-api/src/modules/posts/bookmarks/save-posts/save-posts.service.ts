import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
   */
  async getOrCreateDefaultList(userId: string): Promise<SaveList> {
    let list = await this.saveListRepository.findOne({
      where: { user_id: userId, name: DEFAULT_LIST_NAME },
    });

    if (!list) {
      list = await this.saveListRepository.save({
        user_id: userId,
        name: DEFAULT_LIST_NAME,
      });
    }

    return list;
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
   * Nếu không truyền saveListId, dùng bộ sưu tập mặc định của user.
   */
  async unsavePost(user: IUser, postId: string, saveListId?: string) {
    const listId =
      saveListId || (await this.getOrCreateDefaultList(user.id)).id;

    const saved = await this.savePostRepository.findOne({
      where: { post_id: postId, save_list_id: listId },
    });

    if (!saved) {
      throw new NotFoundException('Saved post not found');
    }

    try {
      await this.savePostRepository.remove(saved);
      return { message: 'Post unsaved successfully' };
    } catch {
      throw new InternalServerErrorException('Error unsaving post');
    }
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
        data: savedPosts.map((sp) => ({
          id: sp.id,
          post: {
            ...sp.post,
            isSaved: true,
            interactions: {
              likes:
                sp.post?.reactions?.filter((r) => r.reaction === 'like')
                  .length || 0,
              comments: sp.post?.comments?.length || 0,
              reposts: 0,
            },
          },
        })),
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
   * Lấy các bài đã lưu của user hiện tại (qua bộ sưu tập mặc định).
   */
  async getMySavedPosts(user: IUser, page: number = 1, limit: number = 10) {
    const list = await this.getOrCreateDefaultList(user.id);
    return this.getSavedPosts(list.id, page, limit);
  }

  /**
   * Lấy danh sách post_id đã lưu (mặc định) để FE đánh dấu nhanh trạng thái.
   */
  async getMySavedPostIds(user: IUser): Promise<string[]> {
    const list = await this.getOrCreateDefaultList(user.id);
    const saved = await this.savePostRepository.find({
      where: { save_list_id: list.id },
      select: ['post_id'],
    });
    return saved.map((s) => s.post_id);
  }

  /**
   * Kiểm tra nhiều post có được lưu trong list mặc định không.
   */
  async filterSavedPostIds(
    userId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    const list = await this.getOrCreateDefaultList(userId);
    const saved = await this.savePostRepository.find({
      where: { save_list_id: list.id, post_id: In(postIds) },
      select: ['post_id'],
    });
    return new Set(saved.map((s) => s.post_id));
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
