import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reaction } from './entities/reaction.entity';
import { Repository } from 'typeorm';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { IUser } from 'src/users/users.interface';
import { ReactionType } from 'src/helper/reaction.enum';
import { RedisService } from 'src/redis/redis.service';
import { NotificationService } from 'src/notifications/notifications.service';
import { Post } from 'src/posts/entities/post.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
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

    // Invalidate post cache if it's a post reaction
    if (postId) {
      await this.redisService.del(`post:${postId}`);

      // Send notification to post owner (only on new reaction or change)
      if (result.reaction) {
        try {
          const post = await this.postRepository.findOne({ where: { id: postId } });
          const actor = await this.userRepository.findOne({ where: { id: user.id } });
          if (post && actor) {
            await this.notificationService.notifyReaction(
              user.id,
              actor.username,
              post.user_id,
              postId,
              result.reaction,
            );
          }
        } catch (e) {
          console.error('Error sending reaction notification:', e);
        }
      }
    }

    return result;
  }

  /**
   * Get reaction summary for a post (counts per type).
   */
  async getReactionSummary(postId: string) {
    const reactions = await this.reactionRepository.find({
      where: { post_id: postId },
    });

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
}
