import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from 'src/common/enums/notification.enum';
import { RoleType } from 'src/common/enums/role.enum';
import { UpdateCommentDto } from './dto/update-comment.dto';
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
import { RelationsService } from 'src/modules/users/relations/relations.service';
import { forwardRef, Inject } from '@nestjs/common';
import { PostVisibilityService } from 'src/modules/posts/post-visibility.service';

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
    @Inject(forwardRef(() => RelationsService))
    private readonly relationsService: RelationsService,
    private readonly postVisibilityService: PostVisibilityService,
  ) {}

  /**
   * Create a new comment on a post.
   */
  async create(user: IUser, dto: CreateCommentDto) {
    try {
      await this.postVisibilityService.assertCanViewPost(dto.post_id, user.id);

      let taggedUsers = dto.tagged_users || [];
      if (typeof taggedUsers === 'string') taggedUsers = [(taggedUsers as string)];
      else if (!Array.isArray(taggedUsers)) taggedUsers = [];

      if (taggedUsers.length > 5) {
        throw new BadRequestException('Bạn chỉ được phép nhắc đến tối đa 5 người trong một bình luận');
      }

      let parentComment = null;
      if (dto.parent_id) {
        parentComment = await this.commentRepository.findOne({
          where: { id: dto.parent_id },
        });

        if (!parentComment || parentComment.is_hidden) {
          throw new NotFoundException('Parent comment is not available');
        }

        if (parentComment.post_id !== dto.post_id) {
          throw new BadRequestException('Parent comment does not belong to this post');
        }

        if (parentComment.user_id !== user.id) {
          const areBlockedByParent = await this.relationsService.areBlocked(user.id, parentComment.user_id);
          if (areBlockedByParent) {
            throw new BadRequestException('Không thể gửi bình luận');
          }
        }
      }

      const validTaggedUsers: string[] = [];
      let commentContent = dto.content || '';

      if (taggedUsers.length > 0) {
        for (const taggedUserId of taggedUsers) {
          if (taggedUserId === user.id) continue; // Tự tag bản thân -> bỏ qua (không thông báo)
          let isValid = true;

          // 1. Block check
          const areBlocked = await this.relationsService.areBlocked(user.id, taggedUserId);
          if (areBlocked) isValid = false;

          // 2. Mention Privacy check
          if (isValid) {
            const taggedUser = await this.userRepository.findOne({ where: { id: taggedUserId } });
            if (!taggedUser) {
              isValid = false;
            } else {
              const relationBtoA = await this.relationsService.getRelation(taggedUserId, user.id);
              if (taggedUser.mention_privacy === 'nobody') {
                isValid = false;
              } else if (taggedUser.mention_privacy === 'following' && relationBtoA !== 'following') {
                isValid = false;
              }
            }
          }

          if (isValid) {
            validTaggedUsers.push(taggedUserId);
          } else {
            // Revert back to plain text
            const regex = new RegExp(`@\\[(.*?)\\]\\(${taggedUserId}\\)`, 'g');
            commentContent = commentContent.replace(regex, '@$1');
          }
        }
      }

      const comment = new Comment();
      comment.id = uuidv4();
      comment.user_id = user.id;
      comment.post_id = dto.post_id;
      comment.content = commentContent;
      comment.medias = [];
      comment.parent_id = dto.parent_id || null;
      comment.tagged_users = validTaggedUsers;

      await this.commentRepository.save(comment);

      // Invalidate post cache
      await this.redisService.del(`post:${dto.post_id}`);

      // Send notification to post owner
      try {
        const post = await this.postRepository.findOne({
          where: { id: dto.post_id },
        });
        const actor = await this.userRepository.findOne({
          where: { id: user.id },
        });

        if (post && actor) {
          if (!dto.parent_id) {
            // It's a root comment on the post
            const postOwnerWasMentioned = comment.tagged_users?.includes(post.user_id);
            if (!postOwnerWasMentioned) {
              await this.notificationService.notifyComment(
                user.id,
                actor.username,
                post.user_id,
                dto.post_id,
                comment.id,
              );
            }
          } else {
            // It's a reply to a parent comment
            if (parentComment && parentComment.user_id !== user.id) {
              await this.notificationService.notifyReplyComment(
                user.id,
                actor.username,
                parentComment.user_id,
                dto.post_id,
                comment.id,
              );
            }
          }

          // Notify tagged users
          if (comment.tagged_users && comment.tagged_users.length > 0) {
            for (const taggedUserId of comment.tagged_users) {
              // Tránh tự tag chính mình (đã loại bỏ ở vòng lặp trên, nhưng cứ đề phòng)
              if (taggedUserId === user.id) continue;

              // Tránh double notification: Nếu taggedUserId chính là tác giả parent comment, bỏ qua (notifyReplyComment đã ưu tiên)
              if (parentComment && taggedUserId === parentComment.user_id) continue;

              await this.notificationService.notifyTagInComment(
                user.id,
                actor.username,
                taggedUserId,
                dto.post_id,
                comment.id,
              );
            }
          }
        }
      } catch (e) {
        console.error('Error sending comment notification:', e);
      }

      return {
        message: 'Comment created successfully',
        comment_id: comment.id,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException('Error creating comment');
    }
  }

  /**
   * Update an existing comment's content.
   * Only the comment owner can update.
   */
  async update(commentId: string, user: IUser, dto: UpdateCommentDto) {
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

      const oldTags = comment.tagged_users || [];
      let newTags = oldTags;
      let updatedContent = dto.content !== undefined ? dto.content : comment.content;

      if (dto.tagged_users !== undefined) {
        let inputTags = dto.tagged_users;
        if (typeof inputTags === 'string') inputTags = [(inputTags as string)];
        else if (!Array.isArray(inputTags)) inputTags = [];

        if (inputTags.length > 5) {
          throw new BadRequestException('Bạn chỉ được phép nhắc đến tối đa 5 người trong một bình luận');
        }

        const validNewTags: string[] = [];

        if (inputTags.length > 0) {
          for (const taggedUserId of inputTags) {
            if (taggedUserId === user.id) continue;
            let isValid = true;

            const areBlocked = await this.relationsService.areBlocked(user.id, taggedUserId);
            if (areBlocked) isValid = false;

            if (isValid) {
              const taggedUser = await this.userRepository.findOne({ where: { id: taggedUserId } });
              if (!taggedUser) {
                isValid = false;
              } else {
                const relationBtoA = await this.relationsService.getRelation(taggedUserId, user.id);
                if (taggedUser.mention_privacy === 'nobody') {
                  isValid = false;
                } else if (taggedUser.mention_privacy === 'following' && relationBtoA !== 'following') {
                  isValid = false;
                }
              }
            }

            if (isValid) {
              validNewTags.push(taggedUserId);
            } else if (updatedContent) {
              const regex = new RegExp(`@\\[(.*?)\\]\\(${taggedUserId}\\)`, 'g');
              updatedContent = updatedContent.replace(regex, '@$1');
            }
          }
        }
        newTags = validNewTags;
      }

      comment.content = updatedContent;
      comment.tagged_users = newTags;

      await this.commentRepository.save(comment);

      // Diff tags
      const removedTags = oldTags.filter((tag) => !newTags.includes(tag));
      const addedTags = newTags.filter((tag) => !oldTags.includes(tag));

      const actor = await this.userRepository.findOne({
        where: { id: user.id },
      });

      if (actor) {
        for (const removedId of removedTags) {
          try {
            await this.notificationService.undoNotification(
              user.id,
              removedId,
              comment.post_id,
              'POST',
              NotificationType.MENTION,
              `mention:comment:${comment.id}`,
            );
          } catch (e) {
            console.error('Error undoing tag notification:', e);
          }
        }

        for (const addedId of addedTags) {
          try {
            await this.notificationService.notifyTagInComment(
              user.id,
              actor.username,
              addedId,
              comment.post_id,
              comment.id,
            );
          } catch (e) {
            console.error('Error sending tag notification:', e);
          }
        }
      }

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
   * Allowed: the comment owner, the post owner, or an admin.
   */
  async remove(commentId: string, user: IUser) {
    try {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      const post = await this.postRepository.findOne({
        where: { id: comment.post_id },
        select: ['id', 'user_id'],
      });
      const isCommentOwner = comment.user_id === user.id;
      const isPostOwner = !!post && post.user_id === user.id;
      const isAdmin = user.role === RoleType.ADMIN;

      if (!isCommentOwner && !isPostOwner && !isAdmin) {
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
