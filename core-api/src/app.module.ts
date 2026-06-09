import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from 'src/infra/database/database.module';
import { AuthModule } from './modules/users/auth/auth.module';
import { RedisModule } from './infra/redis/redis.module';
import { DeviceSessionsModule } from './modules/users/device-sessions/device-sessions.module';
import { PostsModule } from './modules/posts/posts.module';
import { NotificationModule } from './modules/notifications/notifications.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullMQModule } from './infra/bullmq/bullmg.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueOptions } from 'bullmq';
import { AppController } from './app.controller';
import { SavePostsModule } from './modules/posts/bookmarks/save-posts/save-posts.module';
import { CommentsModule } from './modules/posts/comments/comments.module';
import { RelationsModule } from './modules/users/relations/relations.module';
import { NotificationUsersModule } from './modules/notifications/notification-users/notification-users.module';
import { SaveListsModule } from './modules/posts/bookmarks/save-lists/save-lists.module';
import { ReactionsModule } from './modules/posts/reactions/reactions.module';

import { AdminsModule } from './modules/admin/admins.module';
import { GatewayModule } from './modules/chats/gateway/gateway.module';
import { PinMessagesModule } from './modules/chats/pin-messages/pin-messages.module';
import { PinChatsModule } from './modules/chats/pin-chats/pin-chats.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { FeedModule } from './feed/feed.module';
import { MediaModule } from './infra/media/media.module';
import { SearchModule } from './search/search.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StoriesModule } from './modules/stories/stories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL'),
          limit: config.get('THROTTLE_LIMIT'),
        },
      ],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (
        configService: ConfigService,
      ): Promise<QueueOptions> => {
        const redisHost = configService.get<string>('BULLMQ_HOST');
        const redisPort = configService.get<number>('BULLMQ_PORT');
        const redisPassword = configService.get<string>('BULLMQ_PASSWORD');
        const redisDb = configService.get<number>('BULLMQ_DB', 1);

        return {
          connection: {
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            db: redisDb,
          },
        };
      },
      inject: [ConfigService],
    }),

    UsersModule,
    AuthModule,
    RedisModule,
    RelationsModule,
    DeviceSessionsModule,
    PostsModule,
    NotificationModule,
    BullMQModule,
    SavePostsModule,
    CommentsModule,
    NotificationUsersModule,
    SaveListsModule,
    ReactionsModule,
    AdminsModule,
    GatewayModule,
    PinMessagesModule,
    PinChatsModule,
    FeedModule,
    MediaModule,
    SearchModule,
    ReportsModule,
    StoriesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // 🛡 System-wide activation speed limit
    },
  ],
})
export class AppModule {}
