import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { Post } from 'src/modules/posts/entities/post.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { RedisModule } from 'src/infra/redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Relation]), RedisModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
