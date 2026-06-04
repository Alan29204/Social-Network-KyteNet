import { Body, Controller, Delete, Get, Patch, Query } from '@nestjs/common';
import { NotificationUsersService } from './notification-users.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IUser } from 'src/modules/users/users.interface';
import { DeleteNotificationUserDto } from './dto/delete-noti-user.dto';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { NotificationService } from '../notifications.service';
import { ApiOkResponse } from '@nestjs/swagger';
import { NotificationListResponseDto, UnreadCountResponseDto } from '../dto/notification-response.dto';
import { forwardRef, Inject } from '@nestjs/common';

@Controller('notification-users')
@ApiTags('Notification Users')
export class NotificationUsersController {
  constructor(
    private readonly notiUsersService: NotificationUsersService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications list (paginated)' })
  @ResponseMessage('Get notifications successfully')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: NotificationListResponseDto })
  getNotifications(
    @User() user: IUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationService.getUserNotifications(
      user.id,
      page || 1,
      limit || 20,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @ResponseMessage('Get unread count successfully')
  getUnreadCount(@User() user: IUser) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ResponseMessage('All notifications marked as read')
  readAllNoti(@User() user: IUser) {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete notification' })
  @ResponseMessage('Delete notification successfully')
  deleteNoti(@User() user: IUser, @Body() dto: DeleteNotificationUserDto) {
    return this.notiUsersService.deleteNoti(user, dto);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete all notifications' })
  @ResponseMessage('Delete all notifications successfully')
  deleteAllNoti(@User() user: IUser) {
    return this.notiUsersService.deleteAllNoti(user);
  }
}
