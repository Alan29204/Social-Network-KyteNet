import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavePost } from './entities/save-post.entity';
import { IUser } from 'src/users/users.interface';

@Injectable()
export class SavePostsService {
  constructor(
    @InjectRepository(SavePost)
    private readonly savePostRepository: Repository<SavePost>,
  ) {}

  /**
   * Save a post to a save list.
   * If already saved, throw error.
   */
  async savePost(user: IUser, postId: string, saveListId: string) {
    // Check if already saved
    const existing = await this.savePostRepository.findOne({
      where: { post_id: postId, save_list_id: saveListId },
    });

    if (existing) {
      throw new BadRequestException('Post already saved to this list');
    }

    try {
      await this.savePostRepository.save({
        post_id: postId,
        save_list_id: saveListId,
      });

      return { message: 'Post saved successfully' };
    } catch {
      throw new InternalServerErrorException('Error saving post');
    }
  }

  /**
   * Remove a saved post.
   */
  async unsavePost(user: IUser, postId: string, saveListId: string) {
    const saved = await this.savePostRepository.findOne({
      where: { post_id: postId, save_list_id: saveListId },
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
  async getSavedPosts(saveListId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    try {
      const [savedPosts, total] = await this.savePostRepository.findAndCount({
        where: { save_list_id: saveListId },
        relations: ['post', 'post.user', 'post.reactions', 'post.comments'],
        skip,
        take: limit,
      });

      return {
        data: savedPosts.map((sp) => ({
          id: sp.id,
          post: {
            ...sp.post,
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
   * Check if a post is saved by the user in any list.
   */
  async isPostSaved(postId: string, saveListId: string): Promise<boolean> {
    const saved = await this.savePostRepository.findOne({
      where: { post_id: postId, save_list_id: saveListId },
    });
    return !!saved;
  }
}
