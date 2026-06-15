import {
  Body,
  Controller,
  Patch,
  Post,
  Get,
  Param,
  NotFoundException,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { ChatRoomsService } from './chat-rooms.service';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { IUser } from 'src/modules/users/users.interface';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { UpdateChatRoomDto } from './dto/update-chat-room.dto';
import { isUUID } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import IdDto from 'src/common/dto/id.dto';
import { GetListChatRoomDto } from './dto/get-list-chat-room.dto';
import { UpdatePermissionAddMemberDto } from './dto/update-permission-add-member.dto';
import { UpdateChatRoomSettingsDto } from './dto/update-chat-room-settings.dto';
import { UpdateChatRoomEmojiDto } from './dto/update-chat-room-emoji.dto';

@ApiTags('Chat Rooms')
@Controller('chat-rooms')
export class ChatRoomsController {
  constructor(private readonly chatRoomsService: ChatRoomsService) {}

  @Get()
  @ResponseMessage('Get list chat room success')
  @ApiOperation({ summary: 'Get list chat room' })
  getListChatRoom(@User() user: IUser, @Query() query: GetListChatRoomDto) {
    return this.chatRoomsService.getListChatRoom(user, query);
  }

  @Get(':id')
  @ResponseMessage('Find chat room success')
  @ApiOperation({ summary: 'Find chat room by ID' })
  findChatRoomById(@Param('id') id: string) {
    if (!isUUID(id)) throw new NotFoundException('Id does not type uuid');
    const room = this.chatRoomsService.findChatRoomByID(id);
    if (!room) throw new NotFoundException('Not found chat room');

    return room;
  }

  @Post()
  @ResponseMessage('Create chat room success')
  @ApiOperation({ summary: 'Create group chat room' })
  createChatRoom(@Body() dto: CreateChatRoomDto, @User() user: IUser) {
    return this.chatRoomsService.createChatRoom(dto, user);
  }

  @Post('direct/:targetUserId')
  @ResponseMessage('Get or create direct chat success')
  @ApiOperation({ summary: 'Get or create a direct (1-on-1) chat' })
  getOrCreateDirectChat(
    @Param('targetUserId') targetUserId: string,
    @User() user: IUser,
  ) {
    return this.chatRoomsService.getOrCreateDirectChat(user.id, targetUserId);
  }

  @Post(':id/read')
  @ResponseMessage('Mark room as read success')
  @ApiOperation({ summary: 'Mark all messages in room as read for user' })
  markRoomAsRead(@Param('id') id: string, @User() user: IUser) {
    if (!isUUID(id)) throw new NotFoundException('Id does not type uuid');
    return this.chatRoomsService.markRoomAsRead(id, user.id);
  }

  @Patch()
  @ResponseMessage('Update name or avatar chat room success')
  @ApiOperation({ summary: 'Update name or avatar chat room' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateChatRoomDto })
  @UseInterceptors(FileInterceptor('avatar-chat-room'))
  updateNameOrAvatar(
    @Body() dto: UpdateChatRoomDto,
    @User() user: IUser,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return this.chatRoomsService.updateNameOrAvatar(dto, user, file);
  }

  @Patch('permission-add-member')
  @ResponseMessage('Update permission add member success')
  @ApiOperation({ summary: 'Update permission add member' })
  updatePermissionAddMember(
    @Body() dto: UpdatePermissionAddMemberDto,
    @User() user: IUser,
  ) {
    return this.chatRoomsService.updatePermissionAddMember(dto, user);
  }

  @Delete()
  @ResponseMessage('Delete chat room success')
  @ApiOperation({ summary: 'Delete chat room' })
  deleteChatRoom(@Body() dto: IdDto, @User() user: IUser) {
    return this.chatRoomsService.deleteChatRoom(dto, user);
  }

  @Patch(':id/settings')
  @ResponseMessage('Update chat room settings success')
  @ApiOperation({ summary: 'Update chat room settings (mute/unmute)' })
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateChatRoomSettingsDto,
    @User() user: IUser,
  ) {
    if (!isUUID(id)) throw new NotFoundException('Id does not type uuid');
    return this.chatRoomsService.updateChatRoomSettings(id, user.id, dto);
  }

  @Patch(':id/emoji')
  @ResponseMessage('Update chat room emoji success')
  @ApiOperation({ summary: 'Update quick emoji for chat room' })
  updateEmoji(
    @Param('id') id: string,
    @Body() dto: UpdateChatRoomEmojiDto,
    @User() user: IUser,
  ) {
    if (!isUUID(id)) throw new NotFoundException('Id does not type uuid');
    return this.chatRoomsService.updateChatRoomEmoji(id, user.id, dto);
  }

  @Delete(':id/history')
  @ResponseMessage('Soft delete chat room history success')
  @ApiOperation({
    summary: 'Soft delete history of a chat room for current user',
  })
  softDeleteHistory(@Param('id') id: string, @User() user: IUser) {
    if (!isUUID(id)) throw new NotFoundException('Id does not type uuid');
    return this.chatRoomsService.softDeleteHistory(id, user.id);
  }

  @Post(':id/accept-request')
  @ResponseMessage('Accept message request success')
  @ApiOperation({ summary: 'Accept a message request' })
  acceptMessageRequest(@Param('id') id: string, @User() user: IUser) {
    if (!isUUID(id)) throw new NotFoundException('Id does not type uuid');
    return this.chatRoomsService.acceptMessageRequest(id, user.id);
  }
}
