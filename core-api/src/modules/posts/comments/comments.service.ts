import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { IUser } from 'src/modules/users/users.interface';
import { RedisService } from 'src/infra/redis/redis.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import { Post } from 'src/modules/posts/entities/post.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new comment on a post.
   */
  async create(user: IUser, dto: CreateCommentDto) {
    try {
      const comment = new Comment();
      comment.id = uuidv4();
      comment.user_id = user.id;
      comment.post_id = dto.post_id;
      comment.content = dto.content;
      comment.medias = [];
      comment.parent_id = dto.parent_id || null;
      comment.tagged_users = dto.tagged_users || [];

      await this.commentRepository.save(comment);

      // Invalidate post cache
      await this.redisService.del(`post:${dto.post_id}`);

      // Send notification to post owner
      try {
        const post = await this.postRepository.findOne({ where: { id: dto.post_id } });
        const actor = await this.userRepository.findOne({ where: { id: user.id } });
        
        if (post && actor) {
          if (!dto.parent_id) {
            // It's a root comment on the post
            await this.notificationService.notifyComment(
              user.id,
              actor.username,
              post.user_id,
              dto.post_id,
            );
          } else {
            // It's a reply to a parent comment
            const parentComment = await this.commentRepository.findOne({ where: { id: dto.parent_id } });
            if (parentComment) {
              await this.notificationService.notifyReplyComment(
                user.id,
                actor.username,
                parentComment.user_id,
                dto.post_id,
              );
            }
          }

          // Notify tagged users
          if (dto.tagged_users && dto.tagged_users.length > 0) {
            for (const taggedUserId of dto.tagged_users) {
              await this.notificationService.notifyTagInComment(
                user.id,
                actor.username,
                taggedUserId,
                dto.post_id,
              );
            }
          }
        }
      } catch (e) {
        console.error('Error sending comment notification:', e);
      }

      return { message: 'Comment created successfully', comment_id: comment.id };
    } catch {
      throw new InternalServerErrorException('Error creating comment');
    }
  }

  /**
   * Update an existing comment's content.
   * Only the comment owner can update.
   */
  async update(commentId: string, user: IUser, content: string) {
    try {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      if (comment.user_id !== user.id) {
        throw new BadRequestException(
          'You are not authorized to update this comment',
        );
      }

      comment.content = content;
      await this.commentRepository.save(comment);

      // Invalidate post cache
      await this.redisService.del(`post:${comment.post_id}`);

      return { message: 'Comment updated successfully' };
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      )
        throw err;
      throw new InternalServerErrorException('Error updating comment');
    }
  }

  /**
   * Delete a comment.
   * Only the comment owner can delete.
   */
  async remove(commentId: string, user: IUser) {
    try {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      if (comment.user_id !== user.id) {
        throw new BadRequestException(
          'You are not authorized to delete this comment',
        );
      }

      const postId = comment.post_id;
      await this.commentRepository.remove(comment);

      // Invalidate post cache
      await this.redisService.del(`post:${postId}`);

      return { message: 'Comment deleted successfully' };
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      )
        throw err;
      throw new InternalServerErrorException('Error deleting comment');
    }
  }
}
