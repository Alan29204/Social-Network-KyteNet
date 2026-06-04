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

      const membersToSave = [
        {
          chat_room_id: room.id,
          user_id: user.id,
          member_type: MemberType.ADMIN,
        },
      ];

      if (dto.members && dto.members.length > 0) {
        const otherMembers = dto.members.filter((mId) => mId !== user.id);
        otherMembers.forEach((mId) => {
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
      // Also clean up last message cache
      await this.redisService.del(`chat_room:last_msg:${room.id}`);

      return { message: 'Chat room deleted' };
    } catch {
      throw new BadRequestException('Delete chat room failed');
    }
  }

  /**
   * Get list of chat rooms for a user, sorted by last activity.
   * Includes last message preview, online status, blocked and request indicators.
   *
   * Optimized: Uses batch SQL queries and Redis pipeline to avoid N+1 problem.
   * Old approach: ~60 queries for 10 rooms → New approach: ~5 queries total.
   */
  async getListChatRoom(user: IUser, query: PaginationDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
      // Step 1: Fetch chat rooms with members (single query with JOINs)
      const chatRooms = await this.chatRoomsRepository
        .createQueryBuilder('room')
        .innerJoin(
          'room.chat_members',
          'my_member',
          'my_member.user_id = :userId',
          { userId: user.id },
        )
        .leftJoinAndSelect('room.chat_members', 'members')
        .leftJoinAndSelect('members.user', 'memberUser')
        .orderBy('room.last_message_at', 'DESC', 'NULLS LAST')
        .addOrderBy('room.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();

      // Step 2: Get total count (single query)
      const total = await this.chatRoomsRepository
        .createQueryBuilder('room')
        .innerJoin(
          'room.chat_members',
          'my_member',
          'my_member.user_id = :userId',
          { userId: user.id },
        )
        .getCount();

      if (chatRooms.length === 0) {
        return { data: [], meta: { page, limit, total, total_pages: 0 } };
      }

      // Step 3: Collect all unique other-user IDs for direct chats (batch preparation)
      const directRooms = chatRooms.filter((r) => r.type === 'direct');
      const otherUserMap = new Map<string, string>(); // roomId -> otherUserId
      const allOtherUserIds = new Set<string>();
      const allMemberUserIds = new Set<string>();

      for (const room of chatRooms) {
        for (const m of room.chat_members || []) {
          allMemberUserIds.add(m.user_id);
          if (m.user_id !== user.id) {
            otherUserMap.set(room.id, m.user_id);
            allOtherUserIds.add(m.user_id);
          }
        }
      }

      // Step 4: Batch block check — single query for ALL direct rooms
      const blockMap = new Map<string, boolean>(); // otherUserId -> isBlocked
      if (allOtherUserIds.size > 0) {
        const otherIds = Array.from(allOtherUserIds);
        const blockResults = await this.chatRoomsRepository.manager.query(
          `SELECT request_side_id, accept_side_id FROM relation
           WHERE relation_type = 'block'
             AND (
               (request_side_id = $1 AND accept_side_id = ANY($2))
               OR
               (accept_side_id = $1 AND request_side_id = ANY($2))
             )`,
          [user.id, otherIds],
        );
        for (const row of blockResults) {
          const otherId =
            row.request_side_id === user.id
              ? row.accept_side_id
              : row.request_side_id;
          blockMap.set(otherId, true);
        }
      }

      // Step 5: Batch follow check — single query for rooms where user is not creator
      const nonCreatorRooms = directRooms.filter(
        (r) => r.created_by !== user.id,
      );
      const creatorIds = [
        ...new Set(nonCreatorRooms.map((r) => r.created_by)),
      ];
      const followSet = new Set<string>(); // creatorIds the user follows
      if (creatorIds.length > 0) {
        const followResults = await this.chatRoomsRepository.manager.query(
          `SELECT accept_side_id FROM relation
           WHERE request_side_id = $1
             AND accept_side_id = ANY($2)
             AND relation_type = 'following'`,
          [user.id, creatorIds],
        );
        for (const row of followResults) {
          followSet.add(row.accept_side_id);
        }
      }

      // Step 6: Batch message count — single query for user's messages in non-creator rooms
      const nonCreatorRoomIds = nonCreatorRooms.map((r) => r.id);
      const msgCountMap = new Map<string, number>(); // roomId -> count
      if (nonCreatorRoomIds.length > 0) {
        const msgCountResults = await this.chatRoomsRepository.manager.query(
          `SELECT chat_room_id, COUNT(id)::int as count
           FROM chat_message
           WHERE chat_room_id = ANY($1) AND created_by = $2
           GROUP BY chat_room_id`,
          [nonCreatorRoomIds, user.id],
        );
        for (const row of msgCountResults) {
          msgCountMap.set(row.chat_room_id, row.count);
        }
      }

      // Step 7: Batch Redis — get all online statuses via pipeline
      const memberIdList = Array.from(allMemberUserIds);
      const redisClient = this.redisService.getClient();
      const pipeline = redisClient.pipeline();
      for (const uid of memberIdList) {
        pipeline.get(`connection_number:${uid}`);
      }
      const redisResults = await pipeline.exec();
      const onlineMap = new Map<string, boolean>();
      memberIdList.forEach((uid, idx) => {
        const val = redisResults?.[idx]?.[1] as string | null;
        onlineMap.set(uid, !!val && parseInt(val) > 0);
      });

      // Step 8: Batch Redis — get all last_messages via pipeline
      const lastMsgPipeline = redisClient.pipeline();
      for (const room of chatRooms) {
        lastMsgPipeline.get(`chat_room:last_msg:${room.id}`);
      }
      const lastMsgResults = await lastMsgPipeline.exec();

      // Step 9: Map everything together (pure in-memory, no more queries)
      const roomsWithLastMessage = chatRooms.map((room, roomIdx) => {
        // Display name
        let displayName = room.name;
        const otherMember = room.chat_members?.find(
          (m) => m.user_id !== user.id,
        );
        if (room.type === 'direct' && otherMember?.user) {
          displayName = otherMember.user.username;
        }

        // Block check (from batch result)
        const otherUserId = otherUserMap.get(room.id);
        const isBlocked = otherUserId ? !!blockMap.get(otherUserId) : false;

        // Request check (from batch results)
        let isRequest = false;
        if (room.type === 'direct' && room.created_by !== user.id) {
          const isFollowing = followSet.has(room.created_by);
          const messageCount = msgCountMap.get(room.id) || 0;
          if (!isFollowing && messageCount === 0) {
            isRequest = true;
          }
        }

        // Members with online status (from batch Redis)
        const membersWithStatus = (room.chat_members || []).map((m) => ({
          id: m.user_id,
          username: m.user?.username,
          full_name: m.user?.full_name,
          avatar: m.user?.avatar,
          member_type: m.member_type,
          is_online: onlineMap.get(m.user_id) || false,
          last_active: m.user?.last_active || null,
        }));

        // Last message (from batch Redis)
        const rawLastMsg = lastMsgResults?.[roomIdx]?.[1] as string | null;
        let lastMessage = null;
        if (rawLastMsg) {
          try {
            lastMessage = JSON.parse(rawLastMsg);
          } catch {
            lastMessage = null;
          }
        }

        // Unread count
        const myMember = room.chat_members?.find((m) => m.user_id === user.id);
        const unreadCount = myMember?.unread_count || 0;

        return {
          id: room.id,
          name: displayName,
          type: room.type,
          avatar: room.avatar,
          unread_count: unreadCount,
          members: membersWithStatus,
          is_blocked: isBlocked,
          is_request: isRequest,
          last_message: lastMessage,
          last_message_at: room.last_message_at || room.created_at,
        };
      });

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

  // Mark all messages in room as read
  async markRoomAsRead(roomId: string, userId: string) {
    try {
      await this.chatMembersRepository.update(
        { chat_room_id: roomId, user_id: userId },
        { unread_count: 0 }
      );
      return { success: true };
    } catch {
      throw new InternalServerErrorException('Error marking room as read');
    }
  }
}
