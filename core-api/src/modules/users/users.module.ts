import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RedisModule } from 'src/infra/redis/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BirthdayJob } from './birthday.job';
import { NotificationModule } from 'src/modules/notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { MediaModule } from 'src/infra/media/media.module';
import { RelationsModule } from 'src/modules/users/relations/relations.module';
import { AuthModule } from 'src/modules/users/auth/auth.module';
import { AvatarProcessor } from './avatar.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MediaModule,
    RedisModule,
    forwardRef(() => AuthModule),
    forwardRef(() => RelationsModule),
    BullModule.registerQueue(
      { name: 'noti-birthday' },
      { name: 'avatar-updates' }
    ),
    ScheduleModule.forRoot(),
    NotificationModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, BirthdayJob, AvatarProcessor],
  exports: [UsersService],
})
export class UsersModule {}
