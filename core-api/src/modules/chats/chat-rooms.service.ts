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
import { ChatMessage } from './entities/chat-message.entity';
import { RedisService } from 'src/infra/redis/redis.service';
import { MediaService } from 'src/infra/media/media.service';
import { ChatMemberStatus } from 'src/common/enums/chat-member-status.enum';
import { GetListChatRoomDto } from './dto/get-list-chat-room.dto';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { IUser } from 'src/modules/users/users.interface';
import { UpdateChatRoomDto } from './dto/update-chat-room.dto';
import { ChatMember } from 'src/modules/chats/entities/chat-member.entity';
import { MemberType } from 'src/common/enums/member.enum';
import IdDto from 'src/common/dto/id.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UpdatePermissionAddMemberDto } from './dto/update-permission-add-member.dto';
import { ChatMembersService } from './chat-members.service';
import { UpdateChatRoomSettingsDto } from './dto/update-chat-room-settings.dto';
import { UpdateChatRoomEmojiDto } from './dto/update-chat-room-emoji.dto';
import { MessageStatusType } from 'src/common/enums/message-status.enum';
import { GatewayGateway } from 'src/modules/chats/gateway/gategate.gateway';
import { RelationsService } from 'src/modules/users/relations/relations.service';
import { User } from 'src/modules/users/entities/user.entity';

@Injectable()
export class ChatRoomsService {
  private readonly roomVisibleStatuses = [
    ChatMemberStatus.ACCEPTED,
    ChatMemberStatus.PENDING,
  ];
  private readonly directRoomMemberVisibleStatuses = [
    ChatMemberStatus.ACCEPTED,
    ChatMemberStatus.PENDING,
    ChatMemberStatus.DECLINED,
  ];

  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomsRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMember)
    private chatMembersRepository: Repository<ChatMember>,
    @InjectRepository(ChatMessage)
    private readonly chatMessagesRepository: Repository<ChatMessage>,
    private readonly redisService: RedisService,
    private readonly mediaService: MediaService,
    @Inject(forwardRef(() => ChatMembersService))
    private readonly chatMemberService: ChatMembersService,
    @Inject(forwardRef(() => GatewayGateway))
    private readonly gatewayGateway: GatewayGateway,
    @Inject(forwardRef(() => RelationsService))
    private readonly relationsService: RelationsService,
  ) {}

  private async areMutualFollowers(userId: string, targetUserId: string) {
    const [userFollowsTarget, targetFollowsUser] = await Promise.all([
      this.relationsService.getRelation(userId, targetUserId),
      this.relationsService.getRelation(targetUserId, userId),
    ]);

    return userFollowsTarget === 'following' && targetFollowsUser === 'following';
  }

  private async buildRoomListItems(chatRooms: ChatRoom[], user: Pick<IUser, 'id'>) {
    if (chatRooms.length === 0) return [];

    const otherUserMap = new Map<string, string>();
    const allOtherUserIds = new Set<string>();
    const allMemberUserIds = new Set<string>();

    for (const room of chatRooms) {
      const visibleMembers = (room.chat_members || []).filter(
        (m) =>
          room.type === 'direct'
            ? this.directRoomMemberVisibleStatuses.includes(m.status)
            : m.status === ChatMemberStatus.ACCEPTED || m.user_id === user.id,
      );

      for (const m of visibleMembers) {
        allMemberUserIds.add(m.user_id);
        if (m.user_id !== user.id) {
          otherUserMap.set(room.id, m.user_id);
          allOtherUserIds.add(m.user_id);
        }
      }
    }

    const blockMap = new Map<string, boolean>();
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

    const memberIdList = Array.from(allMemberUserIds);
    const onlineMap = new Map<string, boolean>();
    if (memberIdList.length > 0) {
      const redisClient = this.redisService.getClient();
      const pipeline = redisClient.pipeline();
      for (const uid of memberIdList) {
        pipeline.get(`presence:${uid}`);
      }
      const redisResults = await pipeline.exec();
      memberIdList.forEach((uid, idx) => {
        const val = redisResults?.[idx]?.[1] as string | null;
        onlineMap.set(uid, !!val);
      });
    }

    const redisClient = this.redisService.getClient();
    const lastMsgPipeline = redisClient.pipeline();
    for (const room of chatRooms) {
      lastMsgPipeline.get(`chat_room:last_msg:${room.id}`);
    }
    const lastMsgResults = await lastMsgPipeline.exec();

    return chatRooms.map((room, roomIdx) => {
      const visibleMembers = (room.chat_members || []).filter(
        (m) =>
          room.type === 'direct'
            ? this.directRoomMemberVisibleStatuses.includes(m.status)
            : m.status === ChatMemberStatus.ACCEPTED || m.user_id === user.id,
      );
      const myMember = visibleMembers.find((m) => m.user_id === user.id);
      const otherMember = visibleMembers.find((m) => m.user_id !== user.id);

      let displayName = room.name;
      if (room.type === 'direct' && otherMember?.user) {
        displayName = otherMember.user.username;
      }

      const rawLastMsg = lastMsgResults?.[roomIdx]?.[1] as string | null;
      let lastMessage = null;
      if (rawLastMsg) {
        try {
          lastMessage = JSON.parse(rawLastMsg);
        } catch {
          lastMessage = null;
        }
      }

      const membersWithStatus = visibleMembers.map((m) => ({
        id: m.user_id,
        username: m.user?.username,
        full_name: m.user?.full_name,
        avatar: m.user?.avatar,
        profile_picture_url: m.user?.avatar,
        member_type: m.member_type,
        is_online: onlineMap.get(m.user_id) || false,
        is_blocked: blockMap.get(m.user_id) || false,
        last_active: m.user?.last_active || null,
        status: m.status,
        unread_count: m.unread_count || 0,
      }));

      const otherUserId = otherUserMap.get(room.id);
      const isBlocked = otherUserId ? !!blockMap.get(otherUserId) : false;

      return {
        id: room.id,
        name: displayName,
        type: room.type,
        avatar: room.avatar,
        created_by: room.created_by,
        created_at: room.created_at,
        unread_count: myMember?.unread_count || 0,
        is_muted: myMember?.is_muted || false,
        quick_emoji: room.quick_emoji || '👍',
        members: membersWithStatus,
        is_blocked: isBlocked,
        is_request: myMember?.status === ChatMemberStatus.PENDING,
        last_message: lastMessage,
        last_message_at: room.last_message_at || room.created_at,
      };
    });
  }

  async getRoomViewForUser(roomId: string, userId: string) {
    const room = await this.chatRoomsRepository
      .createQueryBuilder('room')
      .innerJoin(
        'room.chat_members',
        'my_member',
        'my_member.user_id = :userId',
        { userId },
      )
      .andWhere('room.id = :roomId', { roomId })
      .andWhere('my_member.status IN (:...memberStatuses)', {
        memberStatuses: this.roomVisibleStatuses,
      })
      .leftJoinAndSelect(
        'room.chat_members',
        'members',
        `(
          (room.type = 'direct' AND members.status IN (:...directVisibleStatuses))
          OR members.status = :acceptedStatus
          OR members.user_id = :userId
        )`,
        {
          acceptedStatus: ChatMemberStatus.ACCEPTED,
          directVisibleStatuses: this.directRoomMemberVisibleStatuses,
          userId,
        },
      )
      .leftJoinAndSelect('members.user', 'memberUser')
      .getOne();

    if (!room) return null;
    // Phòng trực tiếp bị chặn: vẫn trả về room view (kèm is_blocked=true) để UI
    // ẩn ô nhập + hiện thông báo, thay vì biến mất gây lỗi giao diện.
    const [roomView] = await this.buildRoomListItems([room], { id: userId });
    return roomView || null;
  }

  async emitRoomUpdatedToUsers(roomId: string, userIds: string[]) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const room = await this.getRoomViewForUser(roomId, userId);
        if (room) {
          this.gatewayGateway.server.to(userId).emit('roomUpdated', room);
        } else {
          this.gatewayGateway.server.to(userId).emit('roomRemoved', {
            room_id: roomId,
          });
        }
      }),
    );
  }

  async emitRoomUpdatedToVisibleMembers(roomId: string, extraUserIds: string[] = []) {
    const members = await this.chatMembersRepository.find({
      where: { chat_room_id: roomId },
      select: ['user_id', 'status'],
    });
    const visibleUserIds = members
      .filter((m) => this.roomVisibleStatuses.includes(m.status))
      .map((m) => m.user_id);

    await this.emitRoomUpdatedToUsers(roomId, [...visibleUserIds, ...extraUserIds]);
  }

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
      if (dto.members && dto.members.length > 0) {
        const allMembers = [user.id, ...dto.members];
        const hasBlock =
          await this.relationsService.hasAnyBlockRelation(allMembers);
        if (hasBlock) {
          throw new BadRequestException(
            'Bạn không thể thêm người dùng này vào nhóm do cài đặt quyền riêng tư của họ.',
          );
        }
      }

      let roomName = dto.name;
      if (!roomName && dto.members && dto.members.length > 0) {
        const allMembersIds = [user.id, ...dto.members];
        const users = await this.chatRoomsRepository.manager
          .createQueryBuilder(User, 'user')
          .select(['user.username'])
          .where('user.id IN (:...ids)', { ids: allMembersIds })
          .getMany();
        roomName = users.map(u => u.username).join(', ');
        if (roomName.length > 30) {
          roomName = roomName.substring(0, 27) + '...';
        }
      }

      const room = await this.chatRoomsRepository.save({
        name: roomName || 'Group Chat',
        type: 'group',
        created_by: user.id,
        // Mặc định nhóm mới: chỉ admin được thêm thành viên (đổi được sau).
        permission_add_member: dto.permission_add_member ?? MemberType.ADMIN,
      });

      const membersToSave = [
        {
          chat_room_id: room.id,
          user_id: user.id,
          member_type: MemberType.ADMIN,
          status: ChatMemberStatus.ACCEPTED,
        },
      ];

      if (dto.members && dto.members.length > 0) {
        const otherMembers = dto.members.filter((mId) => mId !== user.id);
        for (const mId of otherMembers) {
          const rel = await this.relationsService.getRelation(mId, user.id);
          const status =
            rel === 'following'
              ? ChatMemberStatus.ACCEPTED
              : ChatMemberStatus.PENDING;
          membersToSave.push({
            chat_room_id: room.id,
            user_id: mId,
            member_type: MemberType.MEMBER,
            status: status,
          });
        }
      }

      await this.chatMembersRepository.save(membersToSave);

      await this.chatMessagesRepository.save({
        chat_room_id: room.id,
        created_by: user.id,
        message: 'đã tạo nhóm',
        message_status: MessageStatusType.SYSTEM,
      });

      // Update room's last_message_at so it floats to the top of the sidebar
      await this.chatRoomsRepository.update(room.id, {
        last_message_at: () => 'CURRENT_TIMESTAMP',
      });

      // Cache last_message in Redis Hash (for room list preview)
      const lastMsgKey = `chat_room:last_msg:${room.id}`;
      await this.redisService.set(
        lastMsgKey,
        JSON.stringify({
          message: 'đã tạo nhóm',
          message_type: 'system',
          created_by: user.id,
          created_at: new Date(),
        }),
      );

      await this.emitRoomUpdatedToVisibleMembers(room.id);

      return { message: 'Chat room created', room_id: room.id };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
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
      const isMutual = await this.areMutualFollowers(userId, targetUserId);
      const isBlocked = await this.relationsService.areBlocked(
        userId,
        targetUserId,
      );
      if (isBlocked) {
        throw new BadRequestException(
          'Bạn không thể gửi tin nhắn cho người dùng này',
        );
      }

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
        const members = await this.chatMembersRepository.find({
          where: { chat_room_id: existingRoom.id },
        });
        const currentMember = members.find((m) => m.user_id === userId);
        const targetMember = members.find((m) => m.user_id === targetUserId);
        const updates: Promise<unknown>[] = [];

        if (currentMember?.status !== ChatMemberStatus.ACCEPTED) {
          updates.push(
            this.chatMembersRepository.update(
              { chat_room_id: existingRoom.id, user_id: userId },
              { status: ChatMemberStatus.ACCEPTED, deleted_at: null },
            ),
          );
        }

        if (
          targetMember &&
          targetMember.status !== ChatMemberStatus.ACCEPTED
        ) {
          updates.push(
            this.chatMembersRepository.update(
              { chat_room_id: existingRoom.id, user_id: targetUserId },
              {
                status: isMutual
                  ? ChatMemberStatus.ACCEPTED
                  : ChatMemberStatus.PENDING,
                deleted_at: null,
              },
            ),
          );
        }

        if (updates.length > 0) {
          await Promise.all(updates);
          await this.redisService.del(`chat-room:${existingRoom.id}`);
          await this.redisService.del(`chat-members:${existingRoom.id}`);
        }

        const room = await this.getRoomViewForUser(existingRoom.id, userId);
        return { room_id: existingRoom.id, is_new: false, room };
      }

      // Create new direct chat room
      const room = await this.chatRoomsRepository.save({
        name: 'Direct Chat',
        type: 'direct',
        created_by: userId,
        // Direct chat (1-1) không có khái niệm "quyền thêm thành viên".
        permission_add_member: null,
      });

      // Add both users as members
      await this.chatMembersRepository.save([
        {
          chat_room_id: room.id,
          user_id: userId,
          member_type: MemberType.ADMIN,
          status: ChatMemberStatus.ACCEPTED,
        },
        {
          chat_room_id: room.id,
          user_id: targetUserId,
          member_type: MemberType.ADMIN,
          status: isMutual
            ? ChatMemberStatus.ACCEPTED
            : ChatMemberStatus.PENDING,
        },
      ]);

      const roomView = await this.getRoomViewForUser(room.id, userId);
      return { room_id: room.id, is_new: true, room: roomView };
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
    if (member.status !== ChatMemberStatus.ACCEPTED) {
      throw new BadRequestException('You must accept this chat before updating it');
    }

    try {
      if (!dto.name && !file) {
        throw new BadRequestException('Name or avatar is required');
      }

      const updatePayload: Partial<ChatRoom> = {};
      if (dto.name) {
        updatePayload.name = dto.name;
      }

      if (file) {
        // Upload new avatar to SeaweedFS
        const [avatarUrl] = await this.mediaService.uploadFiles(
          [file],
          `chats/avatars`,
        );

        // Delete old avatar if it's not the default
        if (room.avatar && room.avatar !== 'chat-room.png') {
          await this.mediaService.deleteFile(room.avatar);
        }

        updatePayload.avatar = avatarUrl;
      }

      await this.chatRoomsRepository.update({ id: dto.id }, updatePayload);
      await this.redisService.del(`chat-room:${room.id}`);
      await this.redisService.del(`chat-members:${room.id}`);
      await this.emitRoomUpdatedToVisibleMembers(room.id);
      const roomView = await this.getRoomViewForUser(room.id, user.id);

      return { message: 'Chat room updated successfully', room: roomView };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
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
  async getListChatRoom(user: IUser, query: GetListChatRoomDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = query.type || 'primary';
    const statusFilter =
      type === 'requests'
        ? ChatMemberStatus.PENDING
        : ChatMemberStatus.ACCEPTED;

    try {
      const chatRooms = await this.chatRoomsRepository
        .createQueryBuilder('room')
        .innerJoin(
          'room.chat_members',
          'my_member',
          'my_member.user_id = :userId',
          { userId: user.id },
        )
        .andWhere('my_member.status = :status', { status: statusFilter })
        .andWhere(
          '(my_member.deleted_at IS NULL OR room.last_message_at > my_member.deleted_at)',
        )
        .leftJoinAndSelect(
          'room.chat_members',
          'members',
          `(
            (room.type = 'direct' AND members.status IN (:...directVisibleStatuses))
            OR members.status = :acceptedStatus
            OR members.user_id = :userId
          )`,
          {
            acceptedStatus: ChatMemberStatus.ACCEPTED,
            directVisibleStatuses: this.directRoomMemberVisibleStatuses,
            userId: user.id,
          },
        )
        .leftJoinAndSelect('members.user', 'memberUser')
        .orderBy('room.last_message_at', 'DESC', 'NULLS LAST')
        .addOrderBy('room.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();

      const total = await this.chatRoomsRepository
        .createQueryBuilder('room')
        .innerJoin(
          'room.chat_members',
          'my_member',
          'my_member.user_id = :userId',
          { userId: user.id },
        )
        .andWhere('my_member.status = :status', { status: statusFilter })
        .andWhere(
          '(my_member.deleted_at IS NULL OR room.last_message_at > my_member.deleted_at)',
        )
        .getCount();

      if (chatRooms.length === 0) {
        return { data: [], meta: { page, limit, total, total_pages: 0 } };
      }

      const roomsWithLastMessage = await this.buildRoomListItems(chatRooms, user);

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
        { unread_count: 0 },
      );

      // Broadcast roomRead event to other members
      this.gatewayGateway.broadcastToMembers(
        roomId,
        'roomRead',
        {
          chat_room_id: roomId,
          read_by_user_id: userId,
        },
        userId,
      );

      return { success: true };
    } catch {
      throw new InternalServerErrorException('Error marking room as read');
    }
  }

  // Update chat room settings (e.g. is_muted)
  async updateChatRoomSettings(
    roomId: string,
    userId: string,
    dto: UpdateChatRoomSettingsDto,
  ) {
    const member = await this.chatMembersRepository.findOneBy({
      chat_room_id: roomId,
      user_id: userId,
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this chat room');
    }

    try {
      await this.chatMembersRepository.update(
        { chat_room_id: roomId, user_id: userId },
        { is_muted: dto.is_muted },
      );

      // Cache mute status in Redis
      const muteKey = `chat_room:mute:${roomId}:${userId}`;
      if (dto.is_muted) {
        await this.redisService.set(muteKey, '1');
      } else {
        await this.redisService.del(muteKey);
      }
      const room = await this.getRoomViewForUser(roomId, userId);

      return {
        message: 'Chat room settings updated successfully',
        is_muted: dto.is_muted,
        room,
      };
    } catch (error) {
      console.error('Error updating chat room settings:', error);
      throw new BadRequestException('Update settings failed');
    }
  }

  // Update chat room emoji
  async updateChatRoomEmoji(
    roomId: string,
    userId: string,
    dto: UpdateChatRoomEmojiDto,
  ) {
    const room = await this.findChatRoomByID(roomId);
    const member = await this.chatMembersRepository.findOneBy({
      chat_room_id: roomId,
      user_id: userId,
    });

    if (!room || !member) {
      throw new NotFoundException(
        'Chat room not found or you are not a member',
      );
    }

    try {
      await this.chatRoomsRepository.update(
        { id: roomId },
        { quick_emoji: dto.emoji },
      );

      // Clear cache chat room in Redis
      await this.redisService.del(`chat-room:${roomId}`);

      // Broadcast emoji updated event to all members
      await this.gatewayGateway.broadcastToMembers(roomId, 'roomEmojiUpdated', {
        chat_room_id: roomId,
        quick_emoji: dto.emoji,
        updated_by: userId,
      });
      await this.emitRoomUpdatedToVisibleMembers(roomId);

      return {
        message: 'Chat room emoji updated successfully',
        emoji: dto.emoji,
        room: await this.getRoomViewForUser(roomId, userId),
      };
    } catch (error) {
      console.error('Error updating chat room emoji:', error);
      throw new BadRequestException('Update emoji failed');
    }
  }

  // Soft delete history for a user
  async softDeleteHistory(roomId: string, userId: string) {
    const member = await this.chatMembersRepository.findOneBy({
      chat_room_id: roomId,
      user_id: userId,
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this chat room');
    }

    try {
      await this.chatMembersRepository.update(
        { chat_room_id: roomId, user_id: userId },
        { deleted_at: () => 'CURRENT_TIMESTAMP' },
      );

      return { message: 'Chat history deleted successfully' };
    } catch (error) {
      console.error('Error soft deleting chat history:', error);
      throw new BadRequestException('Delete chat history failed');
    }
  }

  // Accept a message request
  async acceptMessageRequest(roomId: string, user: IUser) {
    const member = await this.chatMembersRepository.findOneBy({
      chat_room_id: roomId,
      user_id: user.id,
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this chat room');
    }

    try {
      await this.chatMembersRepository.update(
        { chat_room_id: roomId, user_id: user.id },
        { status: ChatMemberStatus.ACCEPTED },
      );

      const room = await this.chatRoomsRepository.findOne({
        where: { id: roomId },
      });
      if (room && room.type === 'group') {
        const joinedAt = new Date();
        await this.chatMessagesRepository.save({
          chat_room_id: roomId,
          created_by: user.id,
          message: `đã tham gia nhóm`,
          message_status: MessageStatusType.SYSTEM,
          created_at: joinedAt,
        });
        await this.chatRoomsRepository.update(roomId, {
          last_message_at: joinedAt,
        });
        await this.redisService.set(
          `chat_room:last_msg:${roomId}`,
          JSON.stringify({
            message: 'đã tham gia nhóm',
            message_type: 'system',
            created_by: user.id,
            created_at: joinedAt,
          }),
        );
      }

      await this.redisService.del(`chat-room:${roomId}`);
      await this.redisService.del(`chat-members:${roomId}`);
      await this.emitRoomUpdatedToVisibleMembers(roomId, [user.id]);
      const roomView = await this.getRoomViewForUser(roomId, user.id);

      return { message: 'Message request accepted successfully', room: roomView };
    } catch (error) {
      console.error('Error accepting message request:', error);
      throw new BadRequestException('Accept message request failed');
    }
  }

  async declineMessageRequest(roomId: string, user: IUser) {
    const member = await this.chatMembersRepository.findOneBy({
      chat_room_id: roomId,
      user_id: user.id,
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this chat room');
    }

    try {
      await this.chatMembersRepository.update(
        { chat_room_id: roomId, user_id: user.id },
        { status: ChatMemberStatus.DECLINED },
      );

      await this.redisService.del(`chat-room:${roomId}`);
      await this.redisService.del(`chat-members:${roomId}`);
      this.gatewayGateway.server.to(user.id).emit('roomRemoved', {
        room_id: roomId,
      });

      return { message: 'Message request declined successfully', room_id: roomId };
    } catch (error) {
      console.error('Error declining message request:', error);
      throw new BadRequestException('Decline message request failed');
    }
  }
}
