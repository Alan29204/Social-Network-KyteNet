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
import { MulterModule } from '@nestjs/platform-express';
import { MulterConfigService } from 'src/infra/media/multer.config';
import { RelationsModule } from 'src/modules/users/relations/relations.module';
import { NestjsFingerprintModule } from 'nestjs-fingerprint';
import { AuthModule } from 'src/modules/users/auth/auth.module';

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
    MulterModule.registerAsync({
      useClass: MulterConfigService,
    }),
    RedisModule,
    forwardRef(() => AuthModule),
    forwardRef(() => RelationsModule),
    forwardRef(() => DeviceSessionsModule),
    BullModule.registerQueue({ name: 'noti-birthday' }),
    ScheduleModule.forRoot(),
    NotificationModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, BirthdayJob],
  exports: [UsersService],
})
export class UsersModule {}
