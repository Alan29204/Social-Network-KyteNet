import { RedisModule } from '../redis/redis.module';
import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullMQController } from './bullmq.controller';
import { BullModule } from '@nestjs/bullmq';
import { BullMQService } from './bullmq.service';
import { NotiSystemProcessor } from './noti-system.processor';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { NotificationUser } from 'src/modules/notifications/notification-users/entities/notification-user.entity';
import { GatewayModule } from 'src/modules/chats/gateway/gateway.module';
import { MediasPostsProcessor } from './medias-post.processor';
import { FeedModule } from 'src/feed/feed.module';
import { PostsModule } from 'src/modules/posts/posts.module';
import { NotificationModule } from 'src/modules/notifications/notifications.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    RedisModule,
    FeedModule,
    forwardRef(() => PostsModule),
    forwardRef(() => NotificationModule),
    BullModule.registerQueue({ name: 'noti-birthday' }),
    BullModule.registerQueue({ name: 'noti-system' }),
    BullModule.registerQueue({ name: 'create-posts' }),
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([NotificationUser]),
    GatewayModule,
  ],
  controllers: [BullMQController],
  providers: [BullMQService, NotiSystemProcessor, MediasPostsProcessor],
  exports: [NotiSystemProcessor],
})
export class BullMQModule {}
