import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ChatMessage } from './entities/chat-message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { IUser } from 'src/users/users.interface';
import { RedisService } from 'src/redis/redis.service';
import { MediaService } from 'src/media/media.service';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMember } from './entities/chat-member.entity';
import { MessageStatusType } from 'src/helper/message-status.enum';
import { v4 as uuidv4 } from 'uuid';

/** Max messages cached per room in Redis */
const REDIS_CHAT_CACHE_SIZE = 100;

@Injectable()
export class ChatMessagesService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessagesRepository: Repository<ChatMessage>,
    @InjectRepository(ChatRoom)
    private readonly chatRoomsRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMember)
    private readonly chatMembersRepository: Repository<ChatMember>,
    private readonly redisService: RedisService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Create a new chat message.
   * 1. Validate membership
   * 2. Upload media to SeaweedFS (if any)
   * 3. Save to PostgreSQL
   * 4. Push to Redis cache for real-time access
   * 5. Update room's last_message_at
   * Returns the saved message (caller emits via WebSocket)
   */
  async createMessage(
    dto: CreateChatMessageDto,
    user: IUser,
    files?: Express.Multer.File[],
  ): Promise<ChatMessage> {
    // Validate user is member of chat room
    const member = await this.chatMembersRepository.findOne({
      where: { chat_room_id: dto.chat_room_id, user_id: user.id },
    });

    if (!member) {
      throw new BadRequestException('You are not a member of this chat room');
    }

    try {
      // Upload media files if provided
      let medias: string[] = [];
      if (files && files.length > 0) {
        medias = await this.mediaService.uploadFiles(
          files,
          `chats/${dto.chat_room_id}`,
        );
      }

      // Create and save message to DB
      const message = new ChatMessage();
      message.id = uuidv4();
      message.chat_room_id = dto.chat_room_id;
      message.created_by = user.id;
      message.message = dto.message || '';
      message.medias = medias;
      message.message_status = MessageStatusType.NORMAL;

      const savedMessage = await this.chatMessagesRepository.save(message);

      // Load message with user relation for response
      const fullMessage = await this.chatMessagesRepository.findOne({
        where: { id: savedMessage.id },
        relations: ['user'],
      });

      // Push to Redis cache (recent messages list)
      const cacheKey = `chat:${dto.chat_room_id}`;
      await this.redisService.rPush(cacheKey, JSON.stringify(fullMessage));
      // Trim to keep only recent messages in cache
      const listLength = await this.redisService.lLen(cacheKey);
      if (listLength > REDIS_CHAT_CACHE_SIZE) {
        await this.redisService.lTrim(
          cacheKey,
          listLength - REDIS_CHAT_CACHE_SIZE,
          -1,
        );
      }

      // Update room's last_message_at for sorting
      await this.chatRoomsRepository.update(dto.chat_room_id, {
        last_message_at: new Date(),
      });

      return fullMessage;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Error creating message:', error);
      throw new InternalServerErrorException('Error creating message');
    }
  }

  /**
   * Get message history for a chat room with cursor-based pagination.
   * First checks Redis cache, falls back to PostgreSQL for older messages.
   */
  async getMessageHistory(
    roomId: string,
    userId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    // Validate membership
    const member = await this.chatMembersRepository.findOne({
      where: { chat_room_id: roomId, user_id: userId },
    });

    if (!member) {
      throw new BadRequestException('You are not a member of this chat room');
    }

    try {
      const query = this.chatMessagesRepository
        .createQueryBuilder('msg')
        .leftJoinAndSelect('msg.user', 'user')
        .where('msg.chat_room_id = :roomId', { roomId })
        .orderBy('msg.created_at', 'DESC')
        .take(limit);

      if (cursor) {
        query.andWhere('msg.created_at < :cursor', {
          cursor: new Date(Number(cursor)),
        });
      }

      const messages = await query.getMany();

      // Reverse to get chronological order
      messages.reverse();

      const lastMessage = messages[0];
      const nextCursor = lastMessage
        ? new Date(lastMessage.created_at).getTime()
        : null;

      return {
        data: messages,
        meta: {
          next_cursor: nextCursor,
          has_more: messages.length === limit,
        },
      };
    } catch (error) {
      console.error('Error fetching message history:', error);
      throw new InternalServerErrorException('Error fetching message history');
    }
  }

  /**
   * Edit a message (only by the sender).
   */
  async editMessage(messageId: string, userId: string, newContent: string) {
    const message = await this.chatMessagesRepository.findOne({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.created_by !== userId) {
      throw new BadRequestException('You can only edit your own messages');
    }

    message.message = newContent;
    message.message_status = MessageStatusType.EDITED;
    await this.chatMessagesRepository.save(message);

    // Invalidate Redis cache for this room
    await this.redisService.del(`chat:${message.chat_room_id}`);

    return { message: 'Message edited successfully' };
  }

  /**
   * Soft-delete a message (mark as deleted, keep in DB).
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.chatMessagesRepository.findOne({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.created_by !== userId) {
      throw new BadRequestException('You can only delete your own messages');
    }

    // Soft delete: change status and clear content
    message.message = 'This message has been deleted';
    message.message_status = MessageStatusType.DELETED;
    message.medias = [];
    await this.chatMessagesRepository.save(message);

    // Invalidate Redis cache
    await this.redisService.del(`chat:${message.chat_room_id}`);

    return { message: 'Message deleted successfully' };
  }
}
