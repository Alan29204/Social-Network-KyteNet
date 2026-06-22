import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { IUser } from 'src/modules/users/users.interface';
import { RedisService } from 'src/infra/redis/redis.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersService } from 'src/modules/users/users.service';
import { RequestJoinChatRoomDto } from './dto/request-join-chat-room.dto';
import { MemberType } from 'src/common/enums/member.enum';
import { ChatMember } from './entities/chat-member.entity';
import { WaitingMembers } from './entities/waiting-members.entity';
import { ChatRoomsService } from './chat-rooms.service';
import { RelationsService } from 'src/modules/users/relations/relations.service';
import { ChatMessage } from './entities/chat-message.entity';
import { GatewayGateway } from './gateway/gategate.gateway';
import { ChatMemberStatus } from 'src/common/enums/chat-member-status.enum';
import { MessageStatusType } from 'src/common/enums/message-status.enum';

@Injectable()
export class ChatMembersService {
  constructor(
    @InjectRepository(ChatMember)
    private chatMembersRepository: Repository<ChatMember>,
    @InjectRepository(WaitingMembers)
    private readonly waitingMembersRepository: Repository<WaitingMembers>,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => ChatRoomsService))
    private readonly chatRoomService: ChatRoomsService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => RelationsService))
    private readonly relationsService: RelationsService,
    @InjectRepository(ChatMessage)
    private readonly chatMessagesRepository: Repository<ChatMessage>,
    @Inject(forwardRef(() => GatewayGateway))
    private readonly gatewayGateway: GatewayGateway,
  ) {}

  async requestJoinChatRoom(dto: RequestJoinChatRoomDto, user: IUser) {
    try {
      const room = await this.chatRoomService.findChatRoomByID(
        dto.chat_room_id,
      );

      if (!room) throw new NotFoundException('Not found chat room');

      const member = await this.findMemberInChatRoom(dto.chat_room_id, user.id);

      if (member)
        throw new BadRequestException('You already in this chat room');

      if (room.permission_add_member === MemberType.ADMIN) {
        await this.waitingMembersRepository.save({
          chat_room_id: dto.chat_room_id,
          user_id: user.id,
        });
      } else {
        await this.chatMembersRepository.save({
          chat_room_id: dto.chat_room_id,
          user_id: user.id,
          member_type: MemberType.MEMBER,
        });
      }

      return;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;

      throw new InternalServerErrorException('Request join chat room failed');
    }
  }

  // Find All member in chat by chat_member_id
  async findAllMember(chat_room_id: string): Promise<ChatMember[] | null> {
    try {
      const memberCache: ChatMember[] = await this.redisService.hGetAll(
        `chat-members:${chat_room_id}`,
      );

      if (memberCache) return memberCache;

      const allMember = await this.chatMembersRepository.find({
        where: { chat_room_id: chat_room_id },
      });

      if (allMember)
        allMember.map(async (member) => {
          await this.redisService.hSet(
            `chat-members:${member.chat_room_id}`,
            member.user_id,
            JSON.stringify(member),
          );
        });

      return allMember;
    } catch {
      throw new BadRequestException('Find all member in chat room failed');
    }
  }

  /**
   * Finds a chat member in a specific chat room by user ID.
   *
   * First checks the Redis cache for the member. If found, returns the cached member.
   * If not found in the cache, queries the database and updates the cache if the member is found.
   *
   * @param chat_room_id - The ID of the chat room.
   * @param user_id - The ID of the user.
   * @returns A ChatMember object if found, otherwise null.
   */
  async findMemberInChatRoom(
    chat_room_id: string,
    user_id: string,
  ): Promise<ChatMember | null> {
    const memberCache: ChatMember = JSON.parse(
      await this.redisService.hGet(`chat-members:${chat_room_id}`, user_id),
    );

    if (memberCache) return memberCache;

    const memberDb = await this.chatMembersRepository.findOneBy({
      chat_room_id: chat_room_id,
      user_id: user_id,
    });
    if (memberDb)
      await this.redisService.hSet(
        `chat-members:${memberDb.chat_room_id}`,
        memberDb.user_id,
        JSON.stringify(memberDb),
      );
    return memberDb;
  }

  async addMembers(chat_room_id: string, user_ids: string[], user: IUser) {
    const room = await this.chatRoomService.findChatRoomByID(chat_room_id);
    if (!room) throw new NotFoundException('Chat room not found');

    const currentUserMember = await this.findMemberInChatRoom(
      chat_room_id,
      user.id,
    );
    if (!currentUserMember)
      throw new BadRequestException('You are not in this chat room');

    if (
      room.permission_add_member === MemberType.ADMIN &&
      currentUserMember.member_type !== MemberType.ADMIN
    ) {
      throw new BadRequestException(
        'You do not have permission to add members',
      );
    }

    const currentMembers = await this.findAllMember(chat_room_id);
    const currentMemberIds = currentMembers?.map(m => m.user_id) || [];
    const allMembers = Array.from(new Set([...currentMemberIds, ...user_ids]));
    
    if (allMembers.length > 1) {
      const hasBlock = await this.relationsService.hasAnyBlockRelation(allMembers);
      if (hasBlock) {
         throw new BadRequestException('Bạn không thể thêm người dùng này vào nhóm do cài đặt quyền riêng tư của họ.');
      }
    }

    const membersToSave = [];

    for (const userId of user_ids) {
      const existing = await this.findMemberInChatRoom(chat_room_id, userId);
      if (!existing || existing.status === ChatMemberStatus.LEFT || existing.status === ChatMemberStatus.KICKED) {
        const rel = await this.relationsService.getRelation(userId, user.id);
        const status = rel === 'following' ? ChatMemberStatus.ACCEPTED : ChatMemberStatus.PENDING;
        
        if (existing) {
          existing.status = status;
          existing.member_type = MemberType.MEMBER;
          membersToSave.push(existing);
        } else {
          membersToSave.push({
            chat_room_id: chat_room_id,
            user_id: userId,
            member_type: MemberType.MEMBER,
            status: status,
          });
        }
        
      }
    }

    if (membersToSave.length > 0) {
      await this.chatMembersRepository.save(membersToSave);
      
      await this.chatMessagesRepository.save({
        chat_room_id: chat_room_id,
        created_by: user.id,
        message: 'đã thêm thành viên mới',
        message_status: MessageStatusType.SYSTEM,
      });

      await this.redisService.del(`chat-members:${chat_room_id}`);
      await this.redisService.del(`chat-room:${chat_room_id}`);
      
      await this.chatRoomService.emitRoomUpdatedToVisibleMembers(chat_room_id);
    }
    return { message: 'Members added successfully' };
  }

  async removeMember(
    chat_room_id: string,
    target_user_id: string,
    user: IUser,
  ) {
    const room = await this.chatRoomService.findChatRoomByID(chat_room_id);
    if (!room) throw new NotFoundException('Chat room not found');

    const currentUserMember = await this.findMemberInChatRoom(
      chat_room_id,
      user.id,
    );
    if (
      !currentUserMember ||
      currentUserMember.member_type !== MemberType.ADMIN
    ) {
      throw new BadRequestException(
        'You do not have permission to remove members',
      );
    }

    if (user.id === target_user_id) {
      throw new BadRequestException(
        'You cannot remove yourself, use leave room instead',
      );
    }

    await this.chatMembersRepository.update(
      { chat_room_id, user_id: target_user_id },
      { status: ChatMemberStatus.KICKED }
    );
    
    await this.chatMessagesRepository.save({
      chat_room_id: chat_room_id,
      created_by: user.id,
      message: 'đã xóa một thành viên khỏi nhóm',
      message_status: MessageStatusType.SYSTEM,
    });

    await this.redisService.del(`chat-members:${chat_room_id}`);
    await this.redisService.del(`chat-room:${chat_room_id}`);
    this.gatewayGateway.server.to(target_user_id).emit('roomRemoved', {
      room_id: chat_room_id,
    });
    await this.chatRoomService.emitRoomUpdatedToVisibleMembers(chat_room_id);

    return { message: 'Member removed successfully' };
  }

  async promoteAdmin(
    chat_room_id: string,
    target_user_id: string,
    user: IUser,
  ) {
    const room = await this.chatRoomService.findChatRoomByID(chat_room_id);
    if (!room) throw new NotFoundException('Chat room not found');

    const currentUserMember = await this.findMemberInChatRoom(
      chat_room_id,
      user.id,
    );
    if (
      !currentUserMember ||
      currentUserMember.member_type !== MemberType.ADMIN
    ) {
      throw new BadRequestException(
        'You do not have permission to promote members',
      );
    }

    if (user.id === target_user_id) {
      throw new BadRequestException(
        'You are already an admin',
      );
    }

    const targetMember = await this.findMemberInChatRoom(
      chat_room_id,
      target_user_id,
    );
    if (!targetMember || targetMember.status !== ChatMemberStatus.ACCEPTED) {
      throw new BadRequestException('Target user is not a valid member');
    }

    await this.chatMembersRepository.update(
      { chat_room_id, user_id: target_user_id },
      { member_type: MemberType.ADMIN }
    );
    
    await this.chatMessagesRepository.save({
      chat_room_id: chat_room_id,
      created_by: user.id,
      message: 'đã chỉ định một quản trị viên mới',
      message_status: MessageStatusType.SYSTEM,
    });

    await this.redisService.del(`chat-members:${chat_room_id}`);
    await this.redisService.del(`chat-room:${chat_room_id}`);

    await this.chatRoomService.emitRoomUpdatedToVisibleMembers(chat_room_id);

    return { message: 'Member promoted to admin successfully' };
  }

  async leaveRoom(chat_room_id: string, user: IUser) {
    const room = await this.chatRoomService.findChatRoomByID(chat_room_id);
    if (!room) throw new NotFoundException('Chat room not found');

    const member = await this.findMemberInChatRoom(chat_room_id, user.id);
    if (!member)
      throw new BadRequestException('You are not a member of this chat room');

    await this.chatMembersRepository.update(
       { chat_room_id, user_id: user.id },
       { status: ChatMemberStatus.LEFT }
    );
    
    await this.chatMessagesRepository.save({
      chat_room_id: chat_room_id,
      created_by: user.id,
      message: 'đã rời khỏi nhóm',
      message_status: MessageStatusType.SYSTEM,
    });

    if (member.member_type === MemberType.ADMIN) {
       const otherAdmins = await this.chatMembersRepository.count({ 
          where: { chat_room_id, member_type: MemberType.ADMIN, status: ChatMemberStatus.ACCEPTED } 
       });
       
       if (otherAdmins === 0) {
          const oldestMember = await this.chatMembersRepository.findOne({
             where: { chat_room_id, status: ChatMemberStatus.ACCEPTED },
             order: { created_at: 'ASC' }
          });
          
          if (oldestMember) {
             oldestMember.member_type = MemberType.ADMIN;
             await this.chatMembersRepository.save(oldestMember);
             
             await this.chatMessagesRepository.save({
                chat_room_id: chat_room_id,
                created_by: oldestMember.user_id,
                message: 'đã trở thành quản trị viên',
                message_status: MessageStatusType.SYSTEM,
             });
          }
       }
    }

    await this.redisService.del(`chat-members:${chat_room_id}`);
    await this.redisService.del(`chat-room:${chat_room_id}`);
    this.gatewayGateway.server.to(user.id).emit('roomRemoved', {
      room_id: chat_room_id,
    });
    await this.chatRoomService.emitRoomUpdatedToVisibleMembers(chat_room_id);

    return { message: 'Left chat room successfully', room_id: chat_room_id };
  }
}
