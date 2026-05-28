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
import { ResponseMessage, User } from 'src/common/decorators/customize';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IUser } from 'src/modules/users/users.interface';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

@ApiTags('Chat Messages')
@Controller('chat-messages')
export class ChatMessagesController {
  constructor(private readonly chatMessagesService: ChatMessagesService) {}

  @Post()
  @ResponseMessage('Create message to chat successfully')
  @ApiOperation({ summary: 'Send a message to a chat room' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chat_room_id: { type: 'string' },
        message: { type: 'string' },
        'medias-messages': {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
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
