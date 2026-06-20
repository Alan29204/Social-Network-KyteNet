import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReactionsService } from './reactions.service';
import { ReactionsController } from './reactions.controller';
import { Reaction } from './entities/reaction.entity';
import { Post } from 'src/modules/posts/entities/post.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { RedisModule } from 'src/infra/redis/redis.module';
import { NotificationModule } from 'src/modules/notifications/notifications.module';
import { PostsModule } from 'src/modules/posts/posts.module';
import { Comment } from 'src/modules/posts/comments/entities/comment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reaction, Post, User, Comment]),
    RedisModule,
    NotificationModule,
    PostsModule,
  ],
  controllers: [ReactionsController],
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
