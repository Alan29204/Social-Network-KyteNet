import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationUser } from './entities/notification-user.entity';
import { Repository } from 'typeorm';
import { IUser } from 'src/modules/users/users.interface';
import { DeleteNotificationUserDto } from './dto/delete-noti-user.dto';

@Injectable()
export class NotificationUsersService {
  constructor(
    @InjectRepository(NotificationUser)
    private readonly notiUserRepository: Repository<NotificationUser>,
  ) {}

  /**
   * Get paginated list of notifications for a user.
   * Sorted by created_at DESC (newest first).
   */
  async getNotifications(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      const [notifications, total] = await this.notiUserRepository.findAndCount({
        where: { user_id: userId },
        relations: ['notification'],
        order: { notification: { created_at: 'DESC' } },
        skip,
        take: limit,
      });

      return {
        data: notifications.map((nu) => ({
          id: nu.id,
          title: nu.notification?.title,
          message: nu.notification?.message,
          notification_type: nu.notification?.notification_type,
          is_read: nu.is_read,
          created_at: nu.notification?.created_at,
        })),
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
          unread: notifications.filter((n) => !n.is_read).length,
        },
      };
    } catch {
      throw new InternalServerErrorException('Error fetching notifications');
    }
  }

  /**
   * Get unread notification count.
   */
  async getUnreadCount(userId: string) {
    const count = await this.notiUserRepository.count({
      where: { user_id: userId, is_read: false },
    });
    return { unread_count: count };
  }

  /**
   * Mark a single notification as read.
   */
  async readNoti(user_id: string, noti_user_id: string) {
    await this.notiUserRepository.update(
      { id: noti_user_id, user_id: user_id },
      { is_read: true },
    );
  }

  /**
   * Mark ALL notifications as read for a user.
   */
  async readAllNoti(userId: string) {
    await this.notiUserRepository.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
    return { message: 'All notifications marked as read' };
  }

  /**
   * Delete a single notification.
   */
  async deleteNoti(user: IUser, dto: DeleteNotificationUserDto) {
    const result = await this.notiUserRepository.delete({
      id: dto.noti_user_id,
      user_id: user.id,
    });

    if (result.affected === 0) {
      throw new BadRequestException('Notification not found');
    }
  }

  /**
   * Delete ALL notifications for a user.
   */
  async deleteAllNoti(user: IUser) {
    const result = await this.notiUserRepository.delete({
      user_id: user.id,
    });

    if (result.affected === 0) {
      throw new BadRequestException('Notification not found');
    }
  }
}
