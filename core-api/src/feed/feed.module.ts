import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { Post } from 'src/modules/posts/entities/post.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { Reaction } from 'src/modules/posts/reactions/entities/reaction.entity';
import { RedisModule } from 'src/infra/redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Relation, Reaction]), RedisModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
