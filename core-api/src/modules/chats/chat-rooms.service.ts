import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { RedisService } from 'src/infra/redis/redis.service';
import { MediaService } from 'src/infra/media/media.service';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { IUser } from 'src/modules/users/users.interface';
import { UpdateChatRoomDto } from './dto/update-chat-room.dto';
import { ChatMember } from 'src/modules/chats/entities/chat-member.entity';
import { MemberType } from 'src/common/enums/member.enum';
import IdDto from 'src/common/dto/id.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UpdatePermissionAddMemberDto } from './dto/update-permission-add-member.dto';
import { ChatMembersService } from './chat-members.service';

@Injectable()
export class ChatRoomsService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomsRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMember)
    private chatMembersRepository: Repository<ChatMember>,
    private readonly redisService: RedisService,
    private readonly mediaService: MediaService,
    @Inject(forwardRef(() => ChatMembersService))
    private readonly chatMemberService: ChatMembersService,
  ) {}

  // Find chat room by id
  async findChatRoomByID(id: string): Promise<ChatRoom | null> {
    try {
      const roomCache: ChatRoom = await this.redisService.hGetAll(
        `chat-room:${id}`,
      );

      if (roomCache) return roomCache;

      const room = await this.chatRoomsRepository.findOneBy({ id: id });

      if (room) await this.redisService.hMSet(`chat-room:${room.id}`, room);

      return room;
    } catch {
      throw new BadRequestException('Find chat room failed');
    }
  }

  /**
   * Create a group chat room.
   * Adds the creator as ADMIN member.
   */
  async createChatRoom(dto: CreateChatRoomDto, user: IUser) {
    try {
      const room = await this.chatRoomsRepository.save({
        name: dto.name,
        type: 'group',
        created_by: user.id,
      });
      
      const membersToSave = [{
        chat_room_id: room.id,
        user_id: user.id,
        member_type: MemberType.ADMIN,
      }];

      if (dto.members && dto.members.length > 0) {
        const otherMembers = dto.members.filter(mId => mId !== user.id);
        otherMembers.forEach(mId => {
           membersToSave.push({
             chat_room_id: room.id,
             user_id: mId,
             member_type: MemberType.MEMBER,
           });
        });
      }

      await this.chatMembersRepository.save(membersToSave);

      return { message: 'Chat room created', room_id: room.id };
    } catch {
      throw new BadRequestException('Create chat room failed');
    }
  }

  /**
   * Get or create a direct (1-on-1) chat room between two users.
   * If a direct chat already exists, return it.
   */
  async getOrCreateDirectChat(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    try {
      // Check if a direct chat already exists between these users
      const existingRoom = await this.chatRoomsRepository
        .createQueryBuilder('room')
        .innerJoin('room.chat_members', 'cm1', 'cm1.user_id = :userId', {
          userId,
        })
        .innerJoin('room.chat_members', 'cm2', 'cm2.user_id = :targetUserId', {
          targetUserId,
        })
        .where('room.type = :type', { type: 'direct' })
        .getOne();

      if (existingRoom) {
        return { room_id: existingRoom.id, is_new: false };
      }

      // Create new direct chat room
      const room = await this.chatRoomsRepository.save({
        name: 'Direct Chat',
        type: 'direct',
        created_by: userId,
      });

      // Add both users as members
      await this.chatMembersRepository.save([
        {
          chat_room_id: room.id,
          user_id: userId,
          member_type: MemberType.ADMIN,
        },
        {
          chat_room_id: room.id,
          user_id: targetUserId,
          member_type: MemberType.ADMIN,
        },
      ]);

      return { room_id: room.id, is_new: true };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Error creating direct chat');
    }
  }

  // Update name or avatar chat room
  async updateNameOrAvatar(
    dto: UpdateChatRoomDto,
    user: IUser,
    file: Express.Multer.File,
  ) {
    const room = await this.findChatRoomByID(dto.id);

    const member = await this.chatMemberService.findMemberInChatRoom(
      dto.id,
      user.id,
    );

    if (!room || !member)
      throw new NotFoundException(
        'Not found chat room or you do not in this chat',
      );

    try {
      if (!file) {
        await this.chatRoomsRepository.update(
          { id: dto.id },
          { name: dto.name },
        );
      } else {
        // Upload new avatar to SeaweedFS
        const [avatarUrl] = await this.mediaService.uploadFiles(
          [file],
          `chats/avatars`,
        );

        // Delete old avatar if it's not the default
        if (room.avatar && room.avatar !== 'chat-room.png') {
          await this.mediaService.deleteFile(room.avatar);
        }

        await this.chatRoomsRepository.update(
          { id: dto.id },
          {
            name: dto.name,
            avatar: avatarUrl,
          },
        );
      }
      await this.redisService.del(`chat-room:${room.id}`);
      return { message: 'Chat room updated successfully' };
    } catch {
      throw new BadRequestException('Update chat room failed');
    }
  }

  // Update permission add member
  async updatePermissionAddMember(
    dto: UpdatePermissionAddMemberDto,
    user: IUser,
  ) {
    try {
      const room = await this.findChatRoomByID(dto.id);

      const member = await this.chatMemberService.findMemberInChatRoom(
        dto.id,
        user.id,
      );

      if (
        room &&
        member &&
        room.permission_add_member !== dto.new_permission_add_member &&
        member.member_type === MemberType.ADMIN
      ) {
        await this.chatRoomsRepository.update(
          { id: room.id },
          { permission_add_member: dto.new_permission_add_member },
        );
        return;
      }

      throw new BadRequestException(
        'Can not update permission add member because you are not admin or wrong input',
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Update permission add member failed',
      );
    }
  }

  // Delete chat room
  async deleteChatRoom(dto: IdDto, user: IUser) {
    const room = await this.findChatRoomByID(dto.id);

    if (!room || room.created_by !== user.id) {
      throw new NotFoundException(
        'Not found chat room or you do not have permission to delete this chat',
      );
    }

    try {
      await this.chatRoomsRepository.delete({ id: dto.id });
      await this.redisService.del(`chat-room:${room.id}`);
      // Also clean up chat message cache
      await this.redisService.del(`chat:${room.id}`);

      return { message: 'Chat room deleted' };
    } catch {
      throw new BadRequestException('Delete chat room failed');
    }
  }

  /**
   * Get list of chat rooms for a user, sorted by last activity.
   * Includes last message preview and unread indicator.
   */
  async getListChatRoom(user: IUser, query: PaginationDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    try {
      const chatRooms = await this.chatRoomsRepository
        .createQueryBuilder('room')
        .innerJoin('room.chat_members', 'my_member', 'my_member.user_id = :userId', {
          userId: user.id,
        })
        .leftJoinAndSelect('room.chat_members', 'members')
        .leftJoinAndSelect('members.user', 'memberUser')
        .orderBy('COALESCE(room.last_message_at, room.created_at)', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();

      // Get total count
      const total = await this.chatRoomsRepository
        .createQueryBuilder('room')
        .innerJoin('room.chat_members', 'my_member', 'my_member.user_id = :userId', {
          userId: user.id,
        })
        .getCount();

      // Get last message for each room
      const roomsWithLastMessage = await Promise.all(
        chatRooms.map(async (room) => {
          // Get last message from Redis cache or DB
          const cacheKey = `chat:${room.id}`;
          const cachedMessages = await this.redisService.lRange(cacheKey, -1, -1);

          let lastMessage = null;
          if (cachedMessages.length > 0) {
            lastMessage = JSON.parse(cachedMessages[0]);
          }

          // For direct chats, set the other user's name as room name
          let displayName = room.name;
          if (room.type === 'direct') {
            const otherMember = room.chat_members?.find(
              (m) => m.user_id !== user.id,
            );
            if (otherMember?.user) {
              displayName = otherMember.user.username;
            }
          }

          return {
            id: room.id,
            name: displayName,
            type: room.type,
            avatar: room.avatar,
            members: room.chat_members?.map((m) => ({
              id: m.user_id,
              username: m.user?.username,
              avatar: m.user?.avatar,
              member_type: m.member_type,
            })),
            last_message: lastMessage
              ? {
                  message: lastMessage.message,
                  created_by: lastMessage.created_by,
                  created_at: lastMessage.created_at,
                }
              : null,
            last_message_at: room.last_message_at || room.created_at,
          };
        }),
      );

      return {
        data: roomsWithLastMessage,
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting chat rooms:', error);
      throw new InternalServerErrorException('Error getting chat rooms');
    }
  }
}
