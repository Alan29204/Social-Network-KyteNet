import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/modules/users/users.module';
import { RelationsService } from './relations.service';
import { RelationsController } from './relations.controller';
import { Relation } from './entities/relation.entity';
import { FeedModule } from 'src/feed/feed.module';
import { NotificationModule } from 'src/modules/notifications/notifications.module';
import { RecommendationsCron } from './recommendations.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([Relation]),
    forwardRef(() => UsersModule),
    FeedModule,
    NotificationModule,
  ],
  controllers: [RelationsController],
  providers: [RelationsService, RecommendationsCron],
  exports: [RelationsService],
})
export class RelationsModule {}
