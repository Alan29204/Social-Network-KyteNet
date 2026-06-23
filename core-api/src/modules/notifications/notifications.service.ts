import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationUser } from 'src/modules/notifications/notification-users/entities/notification-user.entity';
import { NotificationType } from 'src/common/enums/notification.enum';
import { GatewayGateway } from 'src/modules/chats/gateway/gategate.gateway';
import { IAdmin } from 'src/modules/admin/admin.interface';
import { CreateNotiSystemDto } from './dto/create-noti-system.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationUser)
    private readonly notiUserRepo: Repository<NotificationUser>,
    @InjectQueue('noti-system') private notiQueue: Queue,
    private readonly gateway: GatewayGateway,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════
  //  Interaction Notifications (like, comment, follow)
  // ═══════════════════════════════════════════

  async notifyReaction(
    actorId: string,
    actorName: string,
    postOwnerId: string,
    postId: string,
    reactionType: string,
    commentId?: string,
  ) {
    if (actorId === postOwnerId) return;

    const context = commentId ? 'comment_reaction' : 'post_reaction';
    await this.aggregateAndSave(
      'POST',
      postId,
      postOwnerId,
      NotificationType.REACTION,
      actorId,
      {
        context,
        reaction: reactionType,
        postId,
        commentId,
        aggregationKey: commentId
          ? `reaction:comment:${commentId}`
          : `reaction:post:${postId}`,
      },
    );
  }

  async notifyComment(
    actorId: string,
    actorName: string,
    postOwnerId: string,
    postId: string,
    commentId?: string,
  ) {
    if (actorId === postOwnerId) return;

    await this.aggregateAndSave(
      'POST',
      postId,
      postOwnerId,
      NotificationType.COMMENT,
      actorId,
      {
        context: 'post_comment',
        comment_type: 'post_comment',
        postId,
        commentId,
        aggregationKey: `comment:post:${postId}`,
      },
    );
  }

  async notifyReplyComment(
    actorId: string,
    actorName: string,
    parentCommentOwnerId: string,
    postId: string,
    commentId?: string,
  ) {
    if (actorId === parentCommentOwnerId) return;

    await this.aggregateAndSave(
      'POST',
      postId,
      parentCommentOwnerId,
      NotificationType.COMMENT,
      actorId,
      {
        context: 'reply_comment',
        comment_type: 'reply_comment',
        postId,
        commentId,
        aggregationKey: commentId
          ? `comment:reply:${commentId}`
          : `comment:reply-post:${postId}`,
      },
    );
  }

  async notifyTagInComment(
    actorId: string,
    actorName: string,
    taggedUserId: string,
    postId: string,
    commentId?: string,
  ) {
    if (actorId === taggedUserId) return;

    await this.aggregateAndSave(
      'POST',
      postId,
      taggedUserId,
      NotificationType.MENTION,
      actorId,
      {
        context: 'comment_mention',
        comment_type: 'tag',
        postId,
        commentId,
        aggregationKey: commentId
          ? `mention:comment:${commentId}`
          : `mention:post-comment:${postId}`,
      },
    );
  }

  async notifyMentionInPost(
    actorId: string,
    actorName: string,
    taggedUserId: string,
    postId: string,
  ) {
    if (actorId === taggedUserId) return;

    await this.aggregateAndSave(
      'POST',
      postId,
      taggedUserId,
      NotificationType.MENTION,
      actorId,
      {
        context: 'post_mention',
        postId,
        aggregationKey: `mention:post:${postId}`,
      },
    );
  }

  async notifyFollow(
    actorId: string,
    actorName: string,
    targetUserId: string,
    relationType: string,
    notiType: NotificationType = NotificationType.FOLLOW,
  ) {
    if (actorId === targetUserId) return;

    await this.aggregateAndSave(
      'USER',
      targetUserId,
      targetUserId,
      notiType,
      actorId,
      { relation_type: relationType },
    );
  }

  // ═══════════════════════════════════════════
  //  User APIs
  // ═══════════════════════════════════════════

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    isRead?: boolean,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.notificationRepo
      .createQueryBuilder('noti')
      .innerJoinAndSelect(
        'noti.notification_user',
        'nu',
        'nu.user_id = :userId',
        { userId },
      );

    if (isRead !== undefined) {
      queryBuilder.andWhere('nu.is_read = :isRead', { isRead });
    }

    const [notifications, total] = await queryBuilder
      .orderBy('noti.updated_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: notifications.map((noti) => ({
        id: noti.notification_user[0].id,
        notification_id: noti.id,
        title: noti.title,
        message: noti.message,
        notification_type: noti.notification_type,
        target_type: noti.target_type,
        target_id: noti.target_id,
        is_read: noti.notification_user[0].is_read,
        created_at: noti.created_at,
        updated_at: noti.updated_at,
        metadata: noti.metadata,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.notiUserRepo.count({
      where: { user_id: userId, is_read: false },
    });
    return { unread_count: count };
  }

  async markAsRead(userId: string, notiUserId: string) {
    await this.notiUserRepo.update(
      { id: notiUserId, user_id: userId },
      { is_read: true },
    );
    return { message: 'Marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.notiUserRepo.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
    return { message: 'All marked as read' };
  }

  async markAsUnread(userId: string, notiUserId: string) {
    await this.notiUserRepo.update(
      { id: notiUserId, user_id: userId },
      { is_read: false },
    );
    return { message: 'Marked as unread' };
  }

  async deleteNotification(userId: string, notiUserId: string) {
    await this.notiUserRepo.delete({ id: notiUserId, user_id: userId });
    return { message: 'Notification deleted successfully' };
  }

  async deleteAllNotifications(userId: string) {
    await this.notiUserRepo.delete({ user_id: userId });
    return { message: 'All notifications deleted successfully' };
  }

  // ═══════════════════════════════════════════
  //  System Notifications
  // ═══════════════════════════════════════════

  async createNotiSystem(admin: IAdmin, dto: CreateNotiSystemDto) {
    const notification = new Notification();
    notification.id = uuidv4();
    notification.title = dto.title;
    notification.message = dto.message;
    notification.notification_type = NotificationType.SYSTEM;

    await this.notificationRepo.save(notification);

    this.notiQueue.add(
      'system',
      {
        notification_id: notification.id,
        title: dto.title,
        message: dto.message,
      },
      { removeOnComplete: true },
    );

    return { message: 'System notification created' };
  }

  async notifySystemWarning(userId: string, title: string, message: string) {
    await this.notifySystemToUser(userId, title, message, {
      context: 'system_warning',
    });
  }

  async notifySystemToUser(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ) {
    const notification = new Notification();
    notification.id = uuidv4();
    notification.title = title;
    notification.message = message;
    notification.notification_type = NotificationType.SYSTEM;
    notification.target_type = 'SYSTEM_WARNING';
    notification.target_id = userId;
    notification.metadata = metadata || null;

    await this.notificationRepo.save(notification);

    const notiUser = new NotificationUser();
    notiUser.notification_id = notification.id;
    notiUser.user_id = userId;
    notiUser.is_read = false;
    notiUser.is_sent = true;
    await this.notiUserRepo.save(notiUser);

    const payload = {
      noti_user_id: notiUser.id,
      user_id: userId,
      title: notification.title,
      message: notification.message,
      notification_type: NotificationType.SYSTEM,
      created_at: notification.created_at,
      is_read: false,
      metadata: notification.metadata,
    };
    this.gateway.server.to(userId).emit('notification', payload);
  }

  // ═══════════════════════════════════════════
  //  Undo / Retract Logic
  // ═══════════════════════════════════════════

  async undoNotification(
    actorId: string,
    targetOwnerId: string,
    targetId: string,
    targetType: string,
    type: NotificationType,
    aggregationKey?: string,
  ) {
    // Look for existing notification where this actor might be part of the metadata
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const notificationQb = this.notificationRepo
      .createQueryBuilder('noti')
      .innerJoinAndSelect(
        'noti.notification_user',
        'nu',
        'nu.user_id = :ownerId',
        { ownerId: targetOwnerId },
      )
      .where('noti.target_type = :targetType', { targetType })
      .andWhere('noti.target_id = :targetId', { targetId })
      .andWhere('noti.notification_type = :type', { type })
      .andWhere('noti.created_at >= :yesterday', { yesterday })
      .orderBy('noti.updated_at', 'DESC');

    if (aggregationKey) {
      notificationQb.andWhere("noti.metadata ->> 'aggregationKey' = :aggregationKey", {
        aggregationKey,
      });
    }

    const notification = await notificationQb.getOne();

    if (!notification || !notification.metadata?.actors) return;

    let actorsList: any[] = notification.metadata.actors;
    const actorExists = actorsList.some((a) => a.id === actorId);

    if (!actorExists) return;

    // Filter out the actor
    actorsList = actorsList.filter((a) => a.id !== actorId);

    if (actorsList.length === 0) {
      // If no actors left, completely hard-delete the notification
      const notiUser = notification.notification_user[0];
      await this.notiUserRepo.delete({ id: notiUser.id });
      await this.notificationRepo.delete({ id: notification.id });

      // Tell UI to remove the dot / notification
      this.gateway.server.to(targetOwnerId).emit('notification', {
        action: 'deleted',
        notification_id: notification.id,
      });
    } else {
      // If others still remain, mutate the notification
      const { title, message } = this.buildNotificationText(
        type,
        actorsList,
        notification.metadata,
      );
      notification.title = title;
      notification.message = message;
      notification.metadata.actors = actorsList;

      await this.notificationRepo.save(notification);

      const notiUser = notification.notification_user[0];
      const payload = {
        noti_user_id: notiUser.id,
        user_id: targetOwnerId,
        title: notification.title,
        message: notification.message,
        notification_type: type,
        created_at: notification.created_at,
        is_read: notiUser.is_read,
        metadata: notification.metadata,
      };
      this.gateway.server.to(targetOwnerId).emit('notification', payload);
    }
  }

  async purgeNotifications(blockerId: string, blockedId: string) {
    // Find all notifications generated by BlockedId for BlockerId
    // And vice versa
    const purgeBetween = async (actorId: string, ownerId: string) => {
      const notifications = await this.notificationRepo
        .createQueryBuilder('noti')
        .innerJoinAndSelect(
          'noti.notification_user',
          'nu',
          'nu.user_id = :ownerId',
          { ownerId },
        )
        .getMany();

      for (const noti of notifications) {
        if (noti.metadata?.actors) {
          const hasActor = noti.metadata.actors.some((a: any) => a.id === actorId);
          if (hasActor) {
            // Delete it completely to be safe
            await this.notiUserRepo.delete({ notification_id: noti.id });
            await this.notificationRepo.delete({ id: noti.id });
          }
        }
      }
    };

    await purgeBetween(blockedId, blockerId);
    await purgeBetween(blockerId, blockedId);
  }

  // ═══════════════════════════════════════════
  //  Private helpers
  // ═══════════════════════════════════════════

  private async aggregateAndSave(
    targetType: string,
    targetId: string,
    targetOwnerId: string,
    type: NotificationType,
    actorId: string,
    metadataOverrides?: Record<string, any>,
  ) {
    // 1. Fetch current actor details for cache
    const actor = await this.dataSource.query(
      `SELECT id, username, avatar FROM "user" WHERE id = $1`,
      [actorId],
    );
    if (!actor || actor.length === 0) return;
    const currentActor = {
      id: actor[0].id,
      username: actor[0].username,
      avatar: actor[0].avatar,
    };

    // 2. Look for existing notification in the last 24 hours
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const aggregationKey =
      metadataOverrides?.aggregationKey ||
      metadataOverrides?.aggregation_key ||
      metadataOverrides?.context ||
      null;

    const notificationQb = this.notificationRepo
      .createQueryBuilder('noti')
      .innerJoinAndSelect(
        'noti.notification_user',
        'nu',
        'nu.user_id = :ownerId',
        { ownerId: targetOwnerId },
      )
      .where('noti.target_type = :targetType', { targetType })
      .andWhere('noti.target_id = :targetId', { targetId })
      .andWhere('noti.notification_type = :type', { type })
      .andWhere('noti.created_at >= :yesterday', { yesterday })
      .orderBy('noti.updated_at', 'DESC');

    if (aggregationKey) {
      notificationQb.andWhere("noti.metadata ->> 'aggregationKey' = :aggregationKey", {
        aggregationKey,
      });
    } else {
      notificationQb.andWhere(
        "(noti.metadata ->> 'aggregationKey' IS NULL OR noti.metadata IS NULL)",
      );
    }

    let notification = await notificationQb.getOne();

    let isNew = false;
    let actorsList: any[] = [];

    if (!notification) {
      isNew = true;
      notification = new Notification();
      notification.id = uuidv4();
      notification.notification_type = type;
      notification.target_type = targetType;
      notification.target_id = targetId;
      actorsList = [currentActor];
    } else {
      actorsList = notification.metadata?.actors || [];
      // Remove current actor if exists (to move to front)
      actorsList = actorsList.filter((a) => a.id !== actorId);
      // Add current actor to front
      actorsList.unshift(currentActor);
    }

    // 3. Fetch target details (thumbnail for posts)
    let thumbnail = null;
    if (targetType === 'POST') {
      const post = await this.dataSource.query(
        `SELECT medias FROM post WHERE id = $1`,
        [targetId],
      );
      if (
        post &&
        post.length > 0 &&
        post[0].medias &&
        post[0].medias.length > 0
      ) {
        thumbnail = post[0].medias[0];
      }
    }

    // 4. Build Title and Message based on actorsList length
    const nextMetadata = {
      ...notification.metadata,
      ...metadataOverrides,
      actors: actorsList,
      thumbnail: thumbnail,
    };

    const { title, message } = this.buildNotificationText(
      type,
      actorsList,
      nextMetadata,
    );
    notification.title = title;
    notification.message = message;

    // Save metadata
    notification.metadata = nextMetadata;

    // Save Notification
    await this.notificationRepo.save(notification);

    // Save NotificationUser
    let notiUser: NotificationUser;
    if (isNew) {
      notiUser = new NotificationUser();
      notiUser.notification_id = notification.id;
      notiUser.user_id = targetOwnerId;
      notiUser.is_read = false;
      notiUser.is_sent = true;
      await this.notiUserRepo.save(notiUser);
    } else {
      notiUser = notification.notification_user[0];
      notiUser.is_read = false;
      await this.notiUserRepo.save(notiUser);
    }

    // Push real-time
    const payload = {
      noti_user_id: notiUser.id,
      user_id: targetOwnerId,
      title: notification.title,
      message: notification.message,
      notification_type: type,
      created_at: notification.created_at,
      is_read: false,
      metadata: notification.metadata,
    };
    this.gateway.server.to(targetOwnerId).emit('notification', payload);
  }

  private buildNotificationText(
    type: NotificationType,
    actors: any[],
    metadata?: Record<string, any>,
  ): { title: string; message: string } {
    const actorNames = actors.map((a) => a.username);
    let actorString = '';

    if (actorNames.length === 1) {
      actorString = actorNames[0];
    } else if (actorNames.length === 2) {
      actorString = `${actorNames[0]} và ${actorNames[1]}`;
    } else {
      actorString = `${actorNames[0]}, ${actorNames[1]} và ${actorNames.length - 2} người khác`;
    }

    let title = '';
    let message = '';

    switch (type) {
      case NotificationType.REACTION:
        title =
          metadata?.context === 'comment_reaction'
            ? `${actorString} đã bày tỏ cảm xúc về bình luận của bạn`
            : `${actorString} đã bày tỏ cảm xúc về bài viết của bạn`;
        message = title;
        break;
      case NotificationType.COMMENT:
        title =
          metadata?.context === 'reply_comment' ||
          metadata?.comment_type === 'reply_comment'
            ? `${actorString} đã trả lời bình luận của bạn`
            : `${actorString} đã bình luận về bài viết của bạn`;
        message = title;
        break;
      case NotificationType.FOLLOW:
        title = `${actorString} đã bắt đầu theo dõi bạn`;
        message = title;
        break;
      case NotificationType.FOLLOW_REQUEST:
        title = `${actorString} đã gửi yêu cầu theo dõi bạn`;
        message = title;
        break;
      case NotificationType.MENTION:
        title =
          metadata?.context === 'comment_mention' ||
          metadata?.comment_type === 'tag'
            ? `${actorString} đã nhắc đến bạn trong một bình luận`
            : `${actorString} đã nhắc đến bạn trong một bài viết`;
        message = title;
        break;
      default:
        title = 'Thông báo mới';
        message = 'Bạn có một thông báo mới';
    }

    return { title, message };
  }
}
