import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  // ═══════════════════════════════════════════
  //  Interaction Notifications (like, comment, follow)
  // ═══════════════════════════════════════════

  /**
   * Send notification when someone reacts to a post.
   * Does NOT notify if user reacts to their own post.
   */
  async notifyReaction(
    actorId: string,
    actorName: string,
    postOwnerId: string,
    postId: string,
    reactionType: string,
  ) {
    if (actorId === postOwnerId) return; // Don't self-notify

    const noti = await this.createAndSave(
      `${actorName} reacted ${reactionType} to your post`,
      `${actorName} đã bày tỏ cảm xúc ${reactionType} về bài viết của bạn`,
      NotificationType.REACTION,
      postOwnerId,
      { actor_id: actorId, post_id: postId, reaction: reactionType },
    );

    // Push real-time
    this.gateway.server.to(postOwnerId).emit('notification', noti);
  }

  /**
   * Send notification when someone comments on a post.
   */
  async notifyComment(
    actorId: string,
    actorName: string,
    postOwnerId: string,
    postId: string,
  ) {
    if (actorId === postOwnerId) return;

    const noti = await this.createAndSave(
      `${actorName} commented on your post`,
      `${actorName} đã bình luận bài viết của bạn`,
      NotificationType.COMMENT,
      postOwnerId,
      { actor_id: actorId, post_id: postId },
    );

    this.gateway.server.to(postOwnerId).emit('notification', noti);
  }

  /**
   * Send notification when someone follows/friends a user.
   */
  async notifyFollow(
    actorId: string,
    actorName: string,
    targetUserId: string,
    relationType: string,
  ) {
    if (actorId === targetUserId) return;

    const message =
      relationType === 'friend'
        ? `${actorName} đã chấp nhận lời mời kết bạn`
        : `${actorName} đã bắt đầu theo dõi bạn`;

    const noti = await this.createAndSave(
      `${actorName} ${relationType === 'friend' ? 'is now your friend' : 'started following you'}`,
      message,
      NotificationType.FOLLOW,
      targetUserId,
      { actor_id: actorId, relation_type: relationType },
    );

    this.gateway.server.to(targetUserId).emit('notification', noti);
  }

  // ═══════════════════════════════════════════
  //  System Notifications
  // ═══════════════════════════════════════════

  /**
   * Creates a system notification and queues it for distribution to all users.
   */
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

  // ═══════════════════════════════════════════
  //  Private helper
  // ═══════════════════════════════════════════

  /**
   * Create a Notification + NotificationUser record and return
   * the payload to be emitted via WebSocket.
   */
  private async createAndSave(
    title: string,
    message: string,
    type: NotificationType,
    targetUserId: string,
    metadata?: Record<string, string>,
  ) {
    // Create notification
    const notification = new Notification();
    notification.id = uuidv4();
    notification.title = title;
    notification.message = message;
    notification.notification_type = type;
    await this.notificationRepo.save(notification);

    // Create notification-user link
    const notiUser = new NotificationUser();
    notiUser.notification_id = notification.id;
    notiUser.user_id = targetUserId;
    notiUser.is_read = false;
    notiUser.is_sent = true;
    await this.notiUserRepo.save(notiUser);

    return {
      noti_user_id: notiUser.id,
      user_id: targetUserId,
      title,
      message,
      notification_type: type,
      created_at: notification.created_at,
      is_read: false,
      metadata,
    };
  }
}
