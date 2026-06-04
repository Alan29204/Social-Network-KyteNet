import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinMessage } from './entities/pin-messages.entity';
import { ChatMessage } from 'src/modules/chats/entities/chat-message.entity';
import { GatewayGateway } from '../gateway/gategate.gateway';

@Injectable()
export class PinMessagesService {
  constructor(
    @InjectRepository(PinMessage)
    private pinMessageRepository: Repository<PinMessage>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private readonly gatewayGateway: GatewayGateway,
  ) {}

  async togglePinMessage(messageId: string, userId: string) {
    const message = await this.chatMessageRepository.findOne({
      where: { id: messageId },
      relations: ['chat_room'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if already pinned
    const existingPin = await this.pinMessageRepository.findOne({
      where: { chat_message_id: messageId },
    });

    if (existingPin) {
      await this.pinMessageRepository.remove(existingPin);
      
      this.gatewayGateway.broadcastToMembers(
        message.chat_room_id,
        'messageUnpinned',
        { messageId, chat_room_id: message.chat_room_id }
      );
      
      return { message: 'Message unpinned successfully', action: 'unpinned', messageId };
    } else {
      // Check the 3-message limit
      const pinnedCount = await this.pinMessageRepository.count({
        where: { chat_room_id: message.chat_room_id },
      });
      
      if (pinnedCount >= 3) {
        throw new BadRequestException('Bạn chỉ có thể ghim tối đa 3 tin nhắn. Hãy bỏ ghim tin cũ để ghim tin mới');
      }

      const newPin = this.pinMessageRepository.create({
        chat_message_id: messageId,
        chat_room_id: message.chat_room_id,
      });
      const savedPin = await this.pinMessageRepository.save(newPin);
      
      this.gatewayGateway.broadcastToMembers(
        message.chat_room_id,
        'messagePinned',
        { messageId, pinMessage: savedPin, chat_room_id: message.chat_room_id }
      );
      
      return { message: 'Message pinned successfully', action: 'pinned', messageId, pinMessage: savedPin };
    }
  }
}
