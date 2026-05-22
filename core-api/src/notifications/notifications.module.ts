import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notifications.controller';
import { NotificationService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { NotificationUser } from 'src/notification-users/entities/notification-user.entity';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { GatewayModule } from 'src/gateway/gateway.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notification, NotificationUser]),
    BullModule.registerQueue({ name: 'noti-system' }),
    GatewayModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
