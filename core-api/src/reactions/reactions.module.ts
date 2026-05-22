import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReactionsService } from './reactions.service';
import { ReactionsController } from './reactions.controller';
import { Reaction } from './entities/reaction.entity';
import { Post } from 'src/posts/entities/post.entity';
import { User } from 'src/users/entities/user.entity';
import { RedisModule } from 'src/redis/redis.module';
import { NotificationModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reaction, Post, User]),
    RedisModule,
    NotificationModule,
  ],
  controllers: [ReactionsController],
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
