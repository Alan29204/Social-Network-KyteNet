import { Module, forwardRef } from '@nestjs/common';
import { PinMessagesService } from './pin-messages.service';
import { PinMessagesController } from './pin-messages.controller';
import { PinMessage } from './entities/pin-messages.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatMessage } from 'src/modules/chats/entities/chat-message.entity';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PinMessage, ChatMessage]),
    forwardRef(() => GatewayModule),
  ],
  controllers: [PinMessagesController],
  providers: [PinMessagesService],
})
export class PinMessagesModule {}
