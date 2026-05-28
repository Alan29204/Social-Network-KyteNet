import { GatewayGateway } from './gategate.gateway';
import { Module, forwardRef } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { AuthModule } from 'src/modules/users/auth/auth.module';
import { WsAuthMiddleware } from './ws-auth.middleware';
import { NotificationUsersModule } from 'src/modules/notifications/notification-users/notification-users.module';
import { ChatModule } from 'src/modules/chats/chat.module';

@Module({
  imports: [AuthModule, NotificationUsersModule, forwardRef(() => ChatModule)],
  providers: [GatewayService, GatewayGateway, WsAuthMiddleware],
  exports: [GatewayGateway],
})
export class GatewayModule {}
