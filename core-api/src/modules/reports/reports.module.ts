import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import { ChatMessage } from '../chats/entities/chat-message.entity';
import { NotificationModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Post, User, ChatMessage]),
    NotificationModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
