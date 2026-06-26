import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from 'src/infra/database/database.module';
import { Post } from './entities/post.entity';
import { RedisModule } from 'src/infra/redis/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { FeedModule } from 'src/feed/feed.module';
import { RelationsModule } from 'src/modules/users/relations/relations.module';
import { forwardRef } from '@nestjs/common';
import { NotificationModule } from 'src/modules/notifications/notifications.module';
import { PostVisibilityService } from './post-visibility.service';
import { SavePostsModule } from './bookmarks/save-posts/save-posts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]),
    DatabaseModule,
    RedisModule,
    FeedModule,
    forwardRef(() => RelationsModule),
    forwardRef(() => NotificationModule),
    SavePostsModule,
    BullModule.registerQueue({ name: 'create-posts' }),
  ],
  controllers: [PostsController],
  providers: [PostsService, PostVisibilityService],
  exports: [PostsService, PostVisibilityService],
})
export class PostsModule {}
