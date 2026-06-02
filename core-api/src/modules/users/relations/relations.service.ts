import { RelationType } from '../../../common/enums/relation.enum';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
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
  ) {}

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
    const relationRequestAccept = await this.relationRepository.findOne({
      where: {
        request_side_id: user.id,
        accept_side_id: dto.user_id,
      },
    });

    // Relation acceptUser -> requestUser
    const relationAcceptRequest = await this.relationRepository.findOne({
      where: {
        request_side_id: dto.user_id,
        accept_side_id: user.id,
      },
    });

    const relationNew = dto.relation;

    // Update relation requestUser -> acceptUser
    switch (true) {
      // RequestUser -> acceptUser relation following
      case relationNew === RelationType.FOLLOWING &&
        !relationRequestAccept:
        await this.relationRepository.save({
          request_side_id: user.id,
          accept_side_id: dto.user_id,
          relation_type: RelationType.FOLLOWING,
        });

        // Backfill feed with followed user's recent posts
        await this.feedService.backfillFeedOnFollow(user.id, dto.user_id);

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
        !!relationRequestAccept:
        // Already following, do nothing to be idempotent
        break;

      // RequestUser -> acceptUser unfollow
      case relationNew === RelationType.NONE &&
        relationRequestAccept?.relation_type === RelationType.FOLLOWING:
        await this.relationRepository.delete({
          request_side_id: user.id,
          accept_side_id: dto.user_id,
        });

        // Cleanup feed: remove unfollowed user's posts
        await this.feedService.cleanupFeedOnUnfollow(user.id, dto.user_id);
        break;

      case relationNew === RelationType.NONE &&
        !relationRequestAccept:
        // Already unfollowed, do nothing
        break;

      // RequestUser -> acceptUser relation block
      case relationNew === RelationType.BLOCK:
        await this.relationRepository.update(
          { request_side_id: user.id, accept_side_id: dto.user_id },
          { relation_type: RelationType.BLOCK },
        );

        await this.relationRepository.delete({
          request_side_id: dto.user_id,
          accept_side_id: user.id,
        });
        break;

      // Other case
      default:
        throw new BadRequestException('Info input is incorrect');
    }

    return {
      message: `Update relation ${relationNew} successfully`,
    };
  }
}
