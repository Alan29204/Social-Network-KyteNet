import { Module } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { AdminsController } from './admins.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { Post } from 'src/modules/posts/entities/post.entity';
import { AdminGuard } from './admin.guard';
import { ReportsModule } from '../reports/reports.module';
import { NotificationModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Post]),
    ReportsModule,
    NotificationModule,
  ],
  controllers: [AdminsController],
  providers: [AdminsService, AdminGuard],
  exports: [AdminGuard],
})
export class AdminsModule {}
