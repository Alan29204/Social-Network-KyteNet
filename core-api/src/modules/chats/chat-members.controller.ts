import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { ChatMembersService } from './chat-members.service';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';
import { RequestJoinChatRoomDto } from './dto/request-join-chat-room.dto';

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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chat_room_id: { type: 'string' },
        user_ids: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  addMembers(
    @Body('chat_room_id') chat_room_id: string,
    @Body('user_ids') user_ids: string[],
    @User() user: IUser,
  ) {
    return this.chatMembersService.addMembers(chat_room_id, user_ids, user);
  }

  @Delete('remove-member')
  @ResponseMessage('Remove member from chat room successfully')
  @ApiOperation({ summary: 'Remove a member from a chat room (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chat_room_id: { type: 'string' },
        target_user_id: { type: 'string' },
      },
    },
  })
  removeMember(
    @Body('chat_room_id') chat_room_id: string,
    @Body('target_user_id') target_user_id: string,
    @User() user: IUser,
  ) {
    return this.chatMembersService.removeMember(
      chat_room_id,
      target_user_id,
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
