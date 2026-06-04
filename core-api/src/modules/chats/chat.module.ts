import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatMember } from './entities/chat-member.entity';
import { WaitingMembers } from './entities/waiting-members.entity';

import { RedisModule } from 'src/infra/redis/redis.module';
import { UsersModule } from 'src/modules/users/users.module';
import { ChatMembersService } from './chat-members.service';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { ChatRoomsController } from './chat-rooms.controller';
import { ChatMembersController } from './chat-members.controller';
import { ChatMessagesController } from './chat-messages.controller';
import { ChatMessagesService } from './chat-messages.service';
import { ChatRoomsService } from './chat-rooms.service';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatRoom,
      ChatMember,
      WaitingMembers,
      ChatMessage,
      MessageReaction,
    ]),
    RedisModule,
    forwardRef(() => UsersModule),
    forwardRef(() => GatewayModule),
  ],
  controllers: [
    ChatRoomsController,
    ChatMembersController,
    ChatMessagesController,
  ],
  providers: [ChatRoomsService, ChatMembersService, ChatMessagesService],
  exports: [ChatRoomsService, ChatMembersService, ChatMessagesService],
})
export class ChatModule {}
