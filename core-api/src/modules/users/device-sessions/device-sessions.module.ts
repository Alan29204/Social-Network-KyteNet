import { RedisModule } from '../../../infra/redis/redis.module';
import { forwardRef, Module } from '@nestjs/common';
import { DeviceSessionsService } from './device-sessions.service';
import { DeviceSessionsController } from './device-sessions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceSession } from './entities/device-session.entity';
import { UsersModule } from 'src/modules/users/users.module';
import { AuthModule } from 'src/modules/users/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceSession]),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    RedisModule,
  ],
  controllers: [DeviceSessionsController],
  providers: [DeviceSessionsService],
  exports: [DeviceSessionsService],
})
export class DeviceSessionsModule {}
