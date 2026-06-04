import { Module } from '@nestjs/common';
import { NotificationUsersService } from './notification-users.service';
import { NotificationUsersController } from './notification-users.controller';
import { NotificationUser } from './entities/notification-user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notifications.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationUser]), forwardRef(() => NotificationModule)],
  controllers: [NotificationUsersController],
  providers: [NotificationUsersService],
  exports: [NotificationUsersService],
})
export class NotificationUsersModule {}
