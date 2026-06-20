import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from 'src/modules/posts/entities/post.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { RedisModule } from 'src/infra/redis/redis.module';
import { NotificationModule } from 'src/modules/notifications/notifications.module';
import { RelationsModule } from 'src/modules/users/relations/relations.module';
import { forwardRef } from '@nestjs/common';
import { PostsModule } from 'src/modules/posts/posts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Post, User]),
    RedisModule,
    NotificationModule,
    forwardRef(() => RelationsModule),
    PostsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
