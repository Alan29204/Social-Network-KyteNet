import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from 'src/common/enums/notification.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Reaction } from './entities/reaction.entity';
import { Repository } from 'typeorm';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { IUser } from 'src/modules/users/users.interface';
import { ReactionType } from 'src/common/enums/reaction.enum';
import { RedisService } from 'src/infra/redis/redis.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import { Post } from 'src/modules/posts/entities/post.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Comment } from 'src/modules/posts/comments/entities/comment.entity';
import { PostVisibilityService } from 'src/modules/posts/post-visibility.service';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    private readonly postVisibilityService: PostVisibilityService,
  ) {}

  /**
   * Toggle or change reaction on a post or comment.
   * - If no existing reaction → create with specified type
   * - If same reaction exists → remove (unlike)
   * - If different reaction exists → update to new type
   */
  async toggle(createReactionDto: CreateReactionDto, user: IUser) {
    const { postId, commentId, reaction } = createReactionDto;

    if (!postId && !commentId) {
      throw new BadRequestException('Either postId or commentId must be provided');
    }

    let targetPostId = postId;
    let commentOwnerId = null;
    if (commentId) {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
      });
      if (!comment || comment.is_hidden) {
        throw new NotFoundException('Comment is not available');
      }
      if (postId && postId !== comment.post_id) {
        throw new BadRequestException('Comment does not belong to this post');
      }
      targetPostId = comment.post_id;
      commentOwnerId = comment.user_id;
    }

    if (!targetPostId) {
      throw new BadRequestException('Post ID is required');
    }

    await this.postVisibilityService.assertCanViewPost(targetPostId, user.id);

    const reactionType = reaction || ReactionType.LIKE;

    const query: any = { user_id: user.id };
    if (postId) query.post_id = postId;
    if (commentId) query.comment_id = commentId;

    const existingReaction = await this.reactionRepository.findOne({
      where: query,
    });

    let result: { message: string; reaction?: ReactionType };

    if (existingReaction) {
      if (existingReaction.reaction === reactionType) {
        // Same reaction → toggle off (un-react)
        await this.reactionRepository.delete(existingReaction.id);
        
        if (postId) {
          try {
            const post = await this.postRepository.findOne({ where: { id: postId } });
            if (post) {
              await this.notificationService.undoNotification(
                user.id,
                post.user_id,
                postId,
                'POST',
                NotificationType.REACTION,
              );
            }
          } catch (e) {
            console.error('Error undoing reaction notification:', e);
          }
        }

        result = { message: 'Reaction removed' };
      } else {
        // Different reaction → update to new type
        existingReaction.reaction = reactionType;
        await this.reactionRepository.save(existingReaction);
        result = { message: 'Reaction updated', reaction: reactionType };
      }
    } else {
      // No existing → create new reaction
      await this.reactionRepository.save({
        user_id: user.id,
        post_id: postId || null,
        comment_id: commentId || null,
        reaction: reactionType,
      });
      result = { message: 'Reacted', reaction: reactionType };
    }

    // Invalidate post cache
    if (targetPostId) {
      await this.redisService.del(`post:${targetPostId}`);
    }

    // Send notification (only on new reaction or change)
    if (result.reaction) {
      try {
        const actor = await this.userRepository.findOne({ where: { id: user.id } });
        if (actor) {
          if (postId) {
            // Post reaction
            const post = await this.postRepository.findOne({ where: { id: postId } });
            if (post) {
              await this.notificationService.notifyReaction(
                user.id,
                actor.username,
                post.user_id,
                postId,
                result.reaction,
              );
            }
          } else if (commentId && targetPostId && commentOwnerId) {
            // Comment reaction
            await this.notificationService.notifyReaction(
              user.id,
              actor.username,
              commentOwnerId,
              targetPostId,
              result.reaction,
            );
          }
        }
      } catch (e) {
        console.error('Error sending reaction notification:', e);
      }
    }

    return result;
  }

  /**
   * Get reaction summary for a post (counts per type).
   */
  async getReactionSummary(postId: string, user: IUser) {
    await this.postVisibilityService.assertCanViewPost(postId, user.id);

    const { blockedUserIds } =
      await this.postVisibilityService.getViewerContext(user.id);
    const qb = this.reactionRepository
      .createQueryBuilder('reaction')
      .where('reaction.post_id = :postId', { postId })
      .andWhere('reaction.is_hidden = false');

    if (blockedUserIds.length > 0) {
      qb.andWhere('reaction.user_id NOT IN (:...blockedUserIds)', {
        blockedUserIds,
      });
    }

    const reactions = await qb.getMany();

    const summary: Record<string, number> = {};
    for (const type of Object.values(ReactionType)) {
      const count = reactions.filter((r) => r.reaction === type).length;
      if (count > 0) summary[type] = count;
    }

    return {
      total: reactions.length,
      breakdown: summary,
    };
  }

  async getPostReactionUsers(
    postId: string,
    user: IUser,
    page: number = 1,
    limit: number = 20,
    reaction: ReactionType = ReactionType.LIKE,
  ) {
    await this.postVisibilityService.assertCanViewPost(postId, user.id);

    page = Math.max(1, Math.floor(Number(page) || 1));
    limit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 20)));

    const { blockedUserIds } =
      await this.postVisibilityService.getViewerContext(user.id);
    const baseQb = this.reactionRepository
      .createQueryBuilder('reaction')
      .innerJoin(User, 'reaction_user', 'reaction_user.id = reaction.user_id')
      .select('reaction_user.id', 'id')
      .addSelect('reaction_user.username', 'username')
      .addSelect('reaction_user.full_name', 'full_name')
      .addSelect('reaction_user.avatar', 'avatar')
      .addSelect('reaction.reaction', 'reaction')
      .addSelect('reaction.created_at', 'reacted_at')
      .where('reaction.post_id = :postId', { postId })
      .andWhere('reaction.reaction = :reaction', { reaction })
      .andWhere('reaction.is_hidden = false');

    if (blockedUserIds.length > 0) {
      baseQb.andWhere('reaction.user_id NOT IN (:...blockedUserIds)', {
        blockedUserIds,
      });
    }

    const qb = baseQb
      .clone()
      .orderBy('reaction.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await Promise.all([
      qb.getRawMany(),
      baseQb.getCount(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        last_page: Math.ceil(total / limit),
      },
    };
  }
}
