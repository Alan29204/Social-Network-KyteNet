import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { ChatMembersService } from './chat-members.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';
import { RequestJoinChatRoomDto } from './dto/request-join-chat-room.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';

@ApiTags('Chat Members')
@Controller('chat-members')
export class ChatMembersController {
  constructor(private readonly chatMembersService: ChatMembersService) {}

  @Post()
  @ResponseMessage('Request join chat room successfully')
  @ApiOperation({
    summary: 'Request join chat room for user not exits in chat room',
  })
  requestJoinChatRoom(
    @Body() dto: RequestJoinChatRoomDto,
    @User() user: IUser,
  ) {
    return this.chatMembersService.requestJoinChatRoom(dto, user);
  }

  @Post('add-members')
  @ResponseMessage('Add members to chat room successfully')
  @ApiOperation({ summary: 'Add multiple members to a chat room' })
  addMembers(@Body() dto: AddMembersDto, @User() user: IUser) {
    return this.chatMembersService.addMembers(
      dto.chat_room_id,
      dto.user_ids,
      user,
    );
  }

  @Delete('remove-member')
  @ResponseMessage('Remove member from chat room successfully')
  @ApiOperation({ summary: 'Remove a member from a chat room (Admin only)' })
  removeMember(@Body() dto: RemoveMemberDto, @User() user: IUser) {
    return this.chatMembersService.removeMember(
      dto.chat_room_id,
      dto.target_user_id,
      user,
    );
  }

  @Delete('leave-room/:chat_room_id')
  @ResponseMessage('Leave chat room successfully')
  @ApiOperation({ summary: 'Leave a chat room' })
  leaveRoom(@Param('chat_room_id') chat_room_id: string, @User() user: IUser) {
    return this.chatMembersService.leaveRoom(chat_room_id, user);
  }
}
