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
import { IUser } from 'src/modules/users/users.interface';
import { DataSource } from 'typeorm';
import { RedisService } from 'src/infra/redis/redis.service';
import { MediaService } from 'src/infra/media/media.service';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMember } from './entities/chat-member.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { MessageStatusType } from 'src/common/enums/message-status.enum';
import { ReactionType } from 'src/common/enums/reaction.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatMessagesService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessagesRepository: Repository<ChatMessage>,
    @InjectRepository(ChatRoom)
    private readonly chatRoomsRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMember)
    private readonly chatMembersRepository: Repository<ChatMember>,
    @InjectRepository(MessageReaction)
    private readonly reactionRepository: Repository<MessageReaction>,
    private readonly redisService: RedisService,
    private readonly mediaService: MediaService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get all member user IDs for a chat room.
   * Used by Gateway to broadcast messages to all members via userId sockets.
   * @param roomId - The chat room ID
   * @returns Array of user IDs that are members of the room
   */
  async getRoomMemberIds(roomId: string): Promise<string[]> {
    const members = await this.chatMembersRepository.find({
      where: { chat_room_id: roomId },
      select: ['user_id'],
    });
    return members.map((m) => m.user_id);
  }

  /**
   * Create a new chat message.
   * 1. Validate membership & privacy
   * 2. Upload media to SeaweedFS (if any)
   * 3. Save to PostgreSQL
   * 4. Cache last_message in Redis Hash
   * 5. Update room's last_message_at
   * Returns the saved message. Caller is responsible for WebSocket broadcasting.
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

    // PRIVACY CHECK: Check if the room is a direct chat
    const room = await this.chatRoomsRepository.findOne({
      where: { id: dto.chat_room_id },
      relations: ['chat_members'],
    });

    if (room && room.type === 'direct') {
      const otherMember = room.chat_members.find((m) => m.user_id !== user.id);
      if (otherMember) {
        // Query other user's message privacy
        const otherUser = await this.dataSource.query(
          `SELECT message_privacy FROM "user" WHERE id = $1`,
          [otherMember.user_id]
        );

        if (otherUser && otherUser.length > 0 && otherUser[0].message_privacy === 'following') {
          // Check if other user is following the current user
          const isFollowing = await this.dataSource.query(
            `SELECT id FROM relation WHERE request_side_id = $1 AND accept_side_id = $2 AND relation_type = 'following'`,
            [otherMember.user_id, user.id]
          );

          if (!isFollowing || isFollowing.length === 0) {
            throw new BadRequestException(
              'Bạn không thể gửi tin nhắn cho tài khoản này do cài đặt quyền riêng tư của họ',
            );
          }
        }
      }
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
      if (dto.reply_to_id) {
        message.reply_to_id = dto.reply_to_id;
      }
      if (dto.shared_post_id) {
        message.shared_post_id = dto.shared_post_id;
      }

      const savedMessage = await this.chatMessagesRepository.save(message);

      // Load message with user relation for response
      const fullMessage = await this.chatMessagesRepository.findOne({
        where: { id: savedMessage.id },
        relations: ['user', 'reply_to', 'reply_to.user', 'shared_post', 'shared_post.user'],
      });

      // Cache last_message in Redis Hash (for room list preview)
      const lastMsgKey = `chat_room:last_msg:${dto.chat_room_id}`;
      await this.redisService.set(lastMsgKey, JSON.stringify({
        message: fullMessage.message,
        created_by: fullMessage.created_by,
        created_at: fullMessage.created_at,
      }));

      // Update room's last_message_at for sorting
      await this.chatRoomsRepository.update(dto.chat_room_id, {
        last_message_at: () => 'CURRENT_TIMESTAMP',
      });

      // Increment unread_count for all other members in the room
      await this.dataSource.query(
        `UPDATE chat_member SET unread_count = unread_count + 1 WHERE chat_room_id = $1 AND user_id != $2`,
        [dto.chat_room_id, user.id]
      );

      // Return saved message — caller is responsible for broadcasting
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
        .leftJoinAndSelect('msg.pin_messages', 'pin_messages')
        .leftJoinAndSelect('msg.reply_to', 'reply_to')
        .leftJoinAndSelect('reply_to.user', 'reply_to_user')
        .leftJoinAndSelect('msg.shared_post', 'shared_post')
        .leftJoinAndSelect('shared_post.user', 'shared_post_user')
        .leftJoinAndSelect('msg.reactions', 'reactions')
        .leftJoinAndSelect('reactions.user', 'reaction_user')
        .where('msg.chat_room_id = :roomId', { roomId })
        .orderBy('msg.created_at', 'DESC')
        .take(Number(limit) || 20);

      if (cursor) {
        query.andWhere('msg.created_at < :cursor', {
          cursor: new Date(Number(cursor)),
        });
      }

      if (member.deleted_at) {
        query.andWhere('msg.created_at > :deletedAt', {
          deletedAt: member.deleted_at,
        });
      }

      let messages = await query.getMany();

      // Privacy checks for shared posts
      messages = await Promise.all(
        messages.map(async (msg) => {
          if (msg.shared_post_id) {
            if (!msg.shared_post) {
              // Post was deleted
              (msg as any).shared_post = null;
            } else {
              const post = msg.shared_post;
              let isUnavailable = false;
              let unavailableReason = '';

              if (post.user_id !== userId) {
                // 1. Check if blocked (Author blocked the viewer)
                const isBlocked = await this.dataSource.query(
                  `SELECT id FROM relation WHERE request_side_id = $1 AND accept_side_id = $2 AND relation_type = 'block'`,
                  [post.user_id, userId],
                );
                if (isBlocked && isBlocked.length > 0) {
                  isUnavailable = true;
                  unavailableReason = 'blocked';
                }

                // 2. Check FOLLOWER privacy
                if (!isUnavailable && post.privacy === 'follower') {
                  const isFollowing = await this.dataSource.query(
                    `SELECT id FROM relation WHERE request_side_id = $1 AND accept_side_id = $2 AND relation_type = 'following'`,
                    [userId, post.user_id],
                  );
                  if (!isFollowing || isFollowing.length === 0) {
                    isUnavailable = true;
                    unavailableReason = 'follower';
                  }
                }

                // 3. Check PRIVATE privacy
                if (!isUnavailable && post.privacy === 'private') {
                  isUnavailable = true;
                  unavailableReason = 'private';
                }
              }

              if (isUnavailable) {
                (msg as any).shared_post = {
                  id: post.id,
                  is_unavailable: true,
                  unavailable_reason: unavailableReason,
                  user: post.user,
                };
              }
            }
          }
          return msg;
        }),
      );

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

    // Return edit payload for caller to broadcast
    return {
      message: 'Message edited successfully',
      chat_room_id: message.chat_room_id,
      edited_data: {
        id: message.id,
        chat_room_id: message.chat_room_id,
        message: message.message,
        message_status: message.message_status,
      },
    };
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
    message.message = 'Tin nhắn đã bị thu hồi';
    message.message_status = MessageStatusType.DELETED;
    message.medias = [];
    await this.chatMessagesRepository.save(message);

    // Update last_message cache if this was the last message
    const lastMsgKey = `chat_room:last_msg:${message.chat_room_id}`;
    await this.redisService.set(lastMsgKey, JSON.stringify({
      message: message.message,
      created_by: message.created_by,
      created_at: message.created_at,
    }));

    // Return delete payload for caller to broadcast
    return {
      message: 'Message deleted successfully',
      chat_room_id: message.chat_room_id,
      deleted_data: {
        id: message.id,
        chat_room_id: message.chat_room_id,
        message: message.message,
        message_status: message.message_status,
        medias: [],
      },
    };
  }

  /**
   * Toggle an emoji reaction on a message.
   * - Same reaction type by same user → remove (toggle off)
   * - Different reaction type → update
   * - No existing reaction → create
   */
  async toggleReaction(
    messageId: string,
    userId: string,
    reactionType: ReactionType,
  ) {
    const message = await this.chatMessagesRepository.findOne({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');

    const existing = await this.reactionRepository.findOne({
      where: { chat_message_id: messageId, user_id: userId },
    });

    if (existing && existing.reaction_type === reactionType) {
      // Same reaction → remove (toggle off)
      await this.reactionRepository.remove(existing);
    } else if (existing) {
      // Different reaction → update
      existing.reaction_type = reactionType;
      await this.reactionRepository.save(existing);
    } else {
      // New reaction → create
      await this.reactionRepository.save({
        chat_message_id: messageId,
        user_id: userId,
        reaction_type: reactionType,
      });
    }

    // Return aggregated reactions for this message
    const reactions = await this.reactionRepository.find({
      where: { chat_message_id: messageId },
      relations: ['user'],
    });

    return {
      chat_room_id: message.chat_room_id,
      message_id: messageId,
      reactions,
    };
  }
}
