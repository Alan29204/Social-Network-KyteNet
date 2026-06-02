import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RedisModule } from 'src/infra/redis/redis.module';
import { DeviceSessionsModule } from 'src/modules/users/device-sessions/device-sessions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BirthdayJob } from './birthday.job';
import { NotificationModule } from 'src/modules/notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { MediaModule } from 'src/infra/media/media.module';
import { RelationsModule } from 'src/modules/users/relations/relations.module';
import { NestjsFingerprintModule } from 'nestjs-fingerprint';
import { AuthModule } from 'src/modules/users/auth/auth.module';
import { AvatarProcessor } from './avatar.processor';

@Module({
  imports: [
    NestjsFingerprintModule.forRoot({
      params: ['headers', 'userAgent', 'ipAddress'],
      cookieOptions: {
        name: 'refreshToken', // optional
        httpOnly: true, // optional
      },
    }),
    TypeOrmModule.forFeature([User]),
    MediaModule,
    RedisModule,
    forwardRef(() => AuthModule),
    forwardRef(() => RelationsModule),
    forwardRef(() => DeviceSessionsModule),
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
