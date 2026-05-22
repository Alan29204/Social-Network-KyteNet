import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ChatMessagesService } from './chat-messages.service';
import { ResponseMessage, User } from 'src/decorator/customize';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IUser } from 'src/users/users.interface';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

@ApiTags('Chat Messages')
@Controller('chat-messages')
export class ChatMessagesController {
  constructor(private readonly chatMessagesService: ChatMessagesService) {}

  @Post()
  @ResponseMessage('Create message to chat successfully')
  @ApiOperation({ summary: 'Send a message to a chat room' })
  @UseInterceptors(FilesInterceptor('medias-messages', 5))
  createMessage(
    @Body() dto: CreateChatMessageDto,
    @User() user: IUser,
    @UploadedFiles()
    files: Express.Multer.File[],
  ) {
    return this.chatMessagesService.createMessage(dto, user, files);
  }

  @Get(':roomId')
  @ResponseMessage('Get message history successfully')
  @ApiOperation({ summary: 'Get message history for a chat room' })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMessageHistory(
    @Param('roomId') roomId: string,
    @User() user: IUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatMessagesService.getMessageHistory(
      roomId,
      user.id,
      cursor,
      limit ? parseInt(limit) : 20,
    );
  }

  @Patch(':id')
  @ResponseMessage('Edit message successfully')
  @ApiOperation({ summary: 'Edit a message' })
  editMessage(
    @Param('id') id: string,
    @User() user: IUser,
    @Body('message') message: string,
  ) {
    return this.chatMessagesService.editMessage(id, user.id, message);
  }

  @Delete(':id')
  @ResponseMessage('Delete message successfully')
  @ApiOperation({ summary: 'Delete a message' })
  deleteMessage(@Param('id') id: string, @User() user: IUser) {
    return this.chatMessagesService.deleteMessage(id, user.id);
  }
}
