import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notifications.service';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from 'src/modules/admin/admin.guard';
import { IAdmin } from 'src/modules/admin/admin.interface';
import { Admin, User, ResponseMessage } from 'src/common/decorators/customize';
import { CreateNotiSystemDto } from './dto/create-noti-system.dto';
import { JwtAuthGuard } from 'src/modules/users/auth/jwt-auth.guard';
import { IUser } from 'src/modules/users/users.interface';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import {
  NotificationListResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ResponseMessage('Get user notifications successfully')
  getUserNotifications(
    @User() user: IUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.notificationService.getUserNotifications(
      user.id,
      +page,
      +limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @ResponseMessage('Get unread count successfully')
  getUnreadCount(@User() user: IUser) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ResponseMessage('Mark all notifications as read successfully')
  markAllAsRead(@User() user: IUser) {
    return this.notificationService.markAllAsRead(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ResponseMessage('Mark notification as read successfully')
  markAsRead(@User() user: IUser, @Param('id') notiUserId: string) {
    return this.notificationService.markAsRead(user.id, notiUserId);
  }

  @UseGuards(AdminGuard)
  @Post()
  @ApiOperation({ summary: 'Admin: Create notification system' })
  @ResponseMessage('Create notification system successfully')
  createNotiSystem(@Admin() admin: IAdmin, @Body() dto: CreateNotiSystemDto) {
    return this.notificationService.createNotiSystem(admin, dto);
  }
}
