import { RelationType } from '../../../common/enums/relation.enum';
import { NotificationType } from '../../../common/enums/notification.enum';
import { PrivacyType } from '../../../common/enums/privacy.enum';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IUser } from 'src/modules/users/users.interface';
import { RedisService } from 'src/infra/redis/redis.service';
import { UsersService } from 'src/modules/users/users.service';
import { FeedService } from 'src/feed/feed.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import { Relation } from './entities/relation.entity';
import { UpdateRelationDto } from './dto/update-relation.dto';

@Injectable()
export class RelationsService {
  constructor(
    @InjectRepository(Relation)
    private relationRepository: Repository<Relation>,
    private redisService: RedisService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly feedService: FeedService,
    private readonly notificationService: NotificationService,
    @InjectQueue('block-sweep')
    private readonly blockSweepQueue: Queue,
  ) {}

  /**
   * Kiểm tra có tồn tại quan hệ chặn giữa 2 user (theo 1 trong 2 chiều) hay không.
   * Dùng làm "khóa ghi đè tuyệt đối" cho các module khác (profile, search, chat...).
   */
  async areBlocked(userId: string, otherId: string): Promise<boolean> {
    if (!userId || !otherId || userId === otherId) return false;
    const count = await this.relationRepository.count({
      where: [
        {
          request_side_id: userId,
          accept_side_id: otherId,
          relation_type: RelationType.BLOCK,
        },
        {
          request_side_id: otherId,
          accept_side_id: userId,
          relation_type: RelationType.BLOCK,
        },
      ],
    });
    return count > 0;
  }

  /**
   * A chặn B (Mục III - Absolute Override).
   * - Set quan hệ A->B = BLOCK; drop follow 2 chiều (B->A về NONE).
   * - Dọn feed 2 chiều, purge notifications, enqueue sweep tương tác cũ.
   */
  async blockUser(user: IUser, targetId: string) {
    if (user.id === targetId) {
      throw new BadRequestException('You cannot block yourself');
    }
    const target = await this.usersService.findUserById(targetId);
    if (!target) {
      throw new NotFoundException('User does not exist');
    }

    // Relation A -> B
    let relAB = await this.relationRepository.findOne({
      where: { request_side_id: user.id, accept_side_id: targetId },
    });
    if (!relAB) {
      relAB = this.relationRepository.create({
        request_side_id: user.id,
        accept_side_id: targetId,
      });
    }
    relAB.relation_type = RelationType.BLOCK;
    relAB.is_mutual = false;
    relAB.is_restricted = false;
    await this.relationRepository.save(relAB);

    // Relation B -> A: drop follow/pending về NONE
    const relBA = await this.relationRepository.findOne({
      where: { request_side_id: targetId, accept_side_id: user.id },
    });
    if (relBA && relBA.relation_type !== RelationType.BLOCK) {
      relBA.relation_type = RelationType.NONE;
      relBA.is_mutual = false;
      await this.relationRepository.save(relBA);
    }

    // Dọn feed 2 chiều (loại bài của nhau khỏi feed cache)
    try {
      await this.feedService.cleanupFeedOnUnfollow(user.id, targetId);
      await this.feedService.cleanupFeedOnUnfollow(targetId, user.id);
    } catch (e) {
      console.error('Error cleaning feed on block:', e);
    }

    // Purge notifications 2 chiều
    try {
      await this.notificationService.purgeNotifications(user.id, targetId);
    } catch (e) {
      console.error('Error purging notifications on block:', e);
    }

    // Enqueue sweep tương tác cũ (like/comment chéo)
    try {
      await this.blockSweepQueue.add(
        'block-sweep',
        { userA: user.id, userB: targetId },
        { removeOnComplete: true, removeOnFail: true },
      );
    } catch (e) {
      console.error('Error enqueue block-sweep:', e);
    }

    // Clear Redis Cache for Blocked Users
    await this.redisService.del(`blocked_users:${user.id}`);
    await this.redisService.del(`blocked_users:${targetId}`);

    return { message: 'User blocked successfully' };
  }

  /**
   * A bỏ chặn B (Mục VII - Unblock).
   * - Xóa quan hệ BLOCK A->B (về NONE).
   * - KHÔNG khôi phục follow, KHÔNG khôi phục tương tác đã sweep.
   */
  async unblockUser(user: IUser, targetId: string) {
    const relAB = await this.relationRepository.findOne({
      where: {
        request_side_id: user.id,
        accept_side_id: targetId,
        relation_type: RelationType.BLOCK,
      },
    });
    if (!relAB) {
      throw new NotFoundException('You have not blocked this user');
    }
    relAB.relation_type = RelationType.NONE;
    relAB.is_mutual = false;
    relAB.is_restricted = false;
    await this.relationRepository.save(relAB);

    // Clear Redis Cache for Blocked Users
    await this.redisService.del(`blocked_users:${user.id}`);
    await this.redisService.del(`blocked_users:${targetId}`);

    return { message: 'User unblocked successfully' };
  }

  /**
   * Get all blocked user IDs from Redis cache or DB.
   * Includes both users that current user blocks, and users that block the current user.
   */
  async getAllBlockedUserIds(userId: string): Promise<string[]> {
    const cacheKey = `blocked_users:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    const blocks = await this.relationRepository.find({
      where: [
        { request_side_id: userId, relation_type: RelationType.BLOCK },
        { accept_side_id: userId, relation_type: RelationType.BLOCK },
      ],
      select: ['request_side_id', 'accept_side_id'],
    });

    const blockedUserIds = [
      ...new Set(
        blocks.map((b) =>
          b.request_side_id === userId ? b.accept_side_id : b.request_side_id,
        ),
      ),
    ];

    await this.redisService.set(cacheKey, JSON.stringify(blockedUserIds), 300); // cache for 5 minutes
    return blockedUserIds;
  }

  /**
   * Check if any two users in the array have a BLOCK relation.
   */
  async hasAnyBlockRelation(userIds: string[]): Promise<boolean> {
    if (!userIds || userIds.length < 2) return false;

    const count = await this.relationRepository
      .createQueryBuilder('relation')
      .where('relation.relation_type = :type', { type: RelationType.BLOCK })
      .andWhere('relation.request_side_id IN (:...userIds)', { userIds })
      .andWhere('relation.accept_side_id IN (:...userIds)', { userIds })
      .getCount();

    return count > 0;
  }

  /** Danh sách user mà `userId` đã chặn (phân trang) - Mục VII. */
  async getBlockedUsers(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const [relations, total] = await this.relationRepository.findAndCount({
      where: {
        request_side_id: userId,
        relation_type: RelationType.BLOCK,
      },
      relations: ['accept_side'],
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      page,
      limit,
      total,
      data: relations.map((r) => ({
        id: r.id,
        user: r.accept_side
          ? {
              id: r.accept_side.id,
              username: r.accept_side.username,
              full_name: r.accept_side.full_name,
              avatar: r.accept_side.avatar,
            }
          : null,
        blocked_at: r.created_at,
      })),
    };
  }

  async getListRelation(
    userId: string,
    page: number,
    limit: number,
    relationType: RelationType,
    mode?: 'followers' | 'following',
  ) {
    const offset = (page - 1) * limit;

    // Kiểm tra user có tồn tại không
    const exists = await this.relationRepository.count({
      where: [{ request_side_id: userId }, { accept_side_id: userId }],
    });

    if (!exists) {
      throw new NotFoundException('User not found');
    }

    // Truy vấn danh sách quan hệ
    const query = this.relationRepository
      .createQueryBuilder('relation')
      .leftJoinAndSelect('relation.request_side', 'requestUser')
      .leftJoinAndSelect('relation.accept_side', 'acceptUser')
      .andWhere('relation.relation_type = :relationType', { relationType });

    if (mode === 'followers') {
      query.andWhere('relation.accept_side_id = :userId', { userId });
    } else if (mode === 'following') {
      query.andWhere('relation.request_side_id = :userId', { userId });
    } else {
      query.andWhere(
        '(relation.request_side_id = :userId OR relation.accept_side_id = :userId)',
        { userId },
      );
    }

    const relations = await query.skip(offset).take(limit).getMany();

    return {
      page,
      limit,
      total: relations.length,
      data: relations.map((relation) => ({
        id: relation.id,
        relation_type: relation.relation_type,
        user:
          relation.request_side_id === userId
            ? relation.accept_side
            : relation.request_side,
      })),
    };
  }

  async removeFollower(userId: string, followerId: string) {
    const relation = await this.relationRepository.findOne({
      where: {
        request_side_id: followerId,
        accept_side_id: userId,
        relation_type: RelationType.FOLLOWING,
      },
    });

    if (!relation) {
      throw new NotFoundException('Follower not found');
    }

    await this.relationRepository.remove(relation);

    try {
      await this.notificationService.undoNotification(
        followerId,
        userId,
        userId,
        'USER',
        NotificationType.FOLLOW,
      );
    } catch (e) {
      console.error('Error undoing follow notification:', e);
    }

    return { message: 'Follower removed successfully' };
  }

  async getRelation(id: string, id_other: string): Promise<RelationType> {
    const acceptUser = await this.usersService.findUserById(id_other);
    if (!acceptUser) {
      throw new NotFoundException('User does not exist');
    }

    const relation = await this.relationRepository.findOne({
      where: {
        request_side_id: id,
        accept_side_id: id_other,
      },
    });
    return relation?.relation_type || RelationType.NONE;
  }

  async updateRelation(user: IUser, dto: UpdateRelationDto) {
    const acceptUser = await this.usersService.findUserById(dto.user_id);
    if (!acceptUser) {
      throw new NotFoundException('User does not exist');
    }

    // Relation requestUser -> acceptUser
    let relationRequestAccept = await this.relationRepository.findOne({
      where: {
        request_side_id: user.id,
        accept_side_id: dto.user_id,
      },
    });

    // Relation acceptUser -> requestUser (for checking mutual)
    const relationAcceptRequest = await this.relationRepository.findOne({
      where: {
        request_side_id: dto.user_id,
        accept_side_id: user.id,
      },
    });

    if (dto.action) {
      if (!relationRequestAccept) {
        // Create an empty relation to hold the flags if it doesn't exist
        relationRequestAccept = this.relationRepository.create({
          request_side_id: user.id,
          accept_side_id: dto.user_id,
          relation_type: RelationType.NONE,
        });
      }
      switch (dto.action) {
        case 'restrict':
          relationRequestAccept.is_restricted = true;
          break;
        case 'unrestrict':
          relationRequestAccept.is_restricted = false;
          break;
      }
      await this.relationRepository.save(relationRequestAccept);
      return { message: `Action ${dto.action} performed successfully` };
    }

    const relationNew = dto.relation;
    if (!relationNew) {
      throw new BadRequestException(
        'Relation type is required if action is not provided',
      );
    }

    // Update relation requestUser -> acceptUser
    switch (true) {
      // RequestUser -> acceptUser relation following
      case relationNew === RelationType.FOLLOWING &&
        (!relationRequestAccept ||
          relationRequestAccept.relation_type !== RelationType.FOLLOWING):
        const isPrivate = acceptUser.privacy === PrivacyType.PRIVATE;
        const newType = isPrivate
          ? RelationType.PENDING
          : RelationType.FOLLOWING;

        if (!relationRequestAccept) {
          relationRequestAccept = this.relationRepository.create({
            request_side_id: user.id,
            accept_side_id: dto.user_id,
            relation_type: newType,
          });
        } else {
          relationRequestAccept.relation_type = newType;
        }

        if (
          newType === RelationType.FOLLOWING &&
          relationAcceptRequest &&
          relationAcceptRequest.relation_type === RelationType.FOLLOWING
        ) {
          relationRequestAccept.is_mutual = true;
          relationAcceptRequest.is_mutual = true;
          await this.relationRepository.save([
            relationRequestAccept,
            relationAcceptRequest,
          ]);
        } else {
          await this.relationRepository.save(relationRequestAccept);
        }

        if (newType === RelationType.FOLLOWING) {
          // Backfill feed with followed user's recent posts
          await this.feedService.backfillFeedOnFollow(user.id, dto.user_id);
        }

        // Notify the followed user
        try {
          const requestUser = await this.usersService.findUserById(user.id);
          await this.notificationService.notifyFollow(
            user.id,
            requestUser?.username || 'Someone',
            dto.user_id,
            'following',
          );
        } catch (e) {
          console.error('Error sending follow notification:', e);
        }
        break;

      case relationNew === RelationType.FOLLOWING &&
        relationRequestAccept?.relation_type === RelationType.FOLLOWING:
        // Already following, do nothing to be idempotent
        break;

      // RequestUser -> acceptUser unfollow
      case relationNew === RelationType.NONE &&
        relationRequestAccept &&
        relationRequestAccept.relation_type !== RelationType.NONE:
        const oldType = relationRequestAccept.relation_type;
        relationRequestAccept.relation_type = RelationType.NONE;
        relationRequestAccept.is_mutual = false;

        if (relationAcceptRequest) {
          relationAcceptRequest.is_mutual = false;
          await this.relationRepository.save([
            relationRequestAccept,
            relationAcceptRequest,
          ]);
        } else {
          await this.relationRepository.save(relationRequestAccept);
        }

        if (oldType === RelationType.FOLLOWING) {
          // Cleanup feed: remove unfollowed user's posts
          await this.feedService.cleanupFeedOnUnfollow(user.id, dto.user_id);
        }

        try {
          await this.notificationService.undoNotification(
            user.id,
            dto.user_id,
            dto.user_id,
            'USER',
            NotificationType.FOLLOW,
          );
        } catch (e) {
          console.error('Error undoing follow notification:', e);
        }
        break;

      case relationNew === RelationType.NONE &&
        (!relationRequestAccept ||
          relationRequestAccept.relation_type === RelationType.NONE):
        // Already unfollowed, do nothing
        break;

      // RequestUser -> acceptUser relation block
      case relationNew === RelationType.BLOCK:
        if (!relationRequestAccept) {
          relationRequestAccept = this.relationRepository.create({
            request_side_id: user.id,
            accept_side_id: dto.user_id,
          });
        }
        relationRequestAccept.relation_type = RelationType.BLOCK;
        relationRequestAccept.is_mutual = false;
        await this.relationRepository.save(relationRequestAccept);

        if (relationAcceptRequest) {
          relationAcceptRequest.is_mutual = false;
          relationAcceptRequest.relation_type = RelationType.NONE;
          await this.relationRepository.save(relationAcceptRequest);
        }

        try {
          await this.notificationService.purgeNotifications(
            user.id,
            dto.user_id,
          );
        } catch (e) {
          console.error('Error purging notifications on block:', e);
        }
        break;

      // Other case
      default:
        throw new BadRequestException('Info input is incorrect');
    }

    return {
      message: `Update relation successfully`,
    };
  }

  async getSuggestedUsers(userId: string, limit: number) {
    // 1. Try to get pre-calculated suggestions from Redis (set by CronJob)
    const cached = await this.redisService.get(`suggested:${userId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, limit);
        }
      } catch (e) {
        console.error('Error parsing cached suggestions:', e);
      }
    }

    // 2. Fallback: If no cache (e.g., new user or cron hasn't run), return random users
    const fallbackQuery = `
      SELECT u.id, u.username, u.full_name, u.avatar, 0 as mutual_count, '[]'::json as mutual_friends
      FROM "user" u
      WHERE u.id != $1
      AND u.id NOT IN (
          SELECT accept_side_id FROM relation WHERE request_side_id = $1 AND relation_type IN ('following', 'pending', 'block')
      )
      AND u.id NOT IN (
          SELECT request_side_id FROM relation WHERE accept_side_id = $1 AND relation_type = 'block'
      )
      ORDER BY RANDOM()
      LIMIT $2
    `;

    const fallbackUsers = await this.relationRepository.query(fallbackQuery, [
      userId,
      limit,
    ]);

    return fallbackUsers;
  }
}
