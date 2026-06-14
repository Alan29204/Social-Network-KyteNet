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

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]),
    DatabaseModule,
    RedisModule,
    FeedModule,
    forwardRef(() => RelationsModule),
    BullModule.registerQueue({ name: 'create-posts' }),
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
