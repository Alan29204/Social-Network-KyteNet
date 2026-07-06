import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  forwardRef,
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
import { GatewayGateway } from './gateway/gategate.gateway';

@ApiTags('Chat Messages')
@Controller('chat-messages')
export class ChatMessagesController {
  constructor(
    private readonly chatMessagesService: ChatMessagesService,
    @Inject(forwardRef(() => GatewayGateway))
    private readonly gatewayGateway: GatewayGateway,
  ) {}

  /**
   * Send a message to a chat room (REST path — used for media uploads).
   * After saving, broadcasts 'newMessage' to all room members via userId sockets.
   */
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
        reply_to_id: { type: 'string' },
        shared_post_id: { type: 'string' },
        'medias-messages': {
          type: 'array',
          description:
            'Ảnh/video đính kèm. Tối đa 5 tệp. Chỉ nhận image/* hoặc video/*. Mỗi tệp ≤100MB.',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('medias-messages', 5))
  async createMessage(
    @Body() dto: CreateChatMessageDto,
    @User() user: IUser,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /^(image|video)\/(jpg|jpeg|png|gif|webp|mp4|mov|quicktime|webm)$/,
        })
        .addMaxSizeValidator({ maxSize: 1024 * 1024 * 100 }) // 100MB
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    files: Express.Multer.File[],
  ) {
    console.log('--- RECEIVED DTO IN createMessage ---', dto);
    // Save message to DB
    const savedMessage = await this.chatMessagesService.createMessage(
      dto,
      user,
      files,
    );

    // Broadcast to ALL members via userId sockets (including sender's other tabs)
    await this.gatewayGateway.broadcastToMembers(
      dto.chat_room_id,
      'newMessage',
      savedMessage,
    );

    return savedMessage;
  }

  @Get(':roomId')
  @ResponseMessage('Get message history successfully')
  @ApiOperation({ summary: 'Get message history for a chat room' })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMessageHistory(
    @Param('roomId', ParseUUIDPipe) roomId: string,
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

  /**
   * Edit a message (only by the sender).
   * After editing, broadcasts 'messageEdited' to all room members.
   */
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
  async editMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
    @Body('message') message: string,
  ) {
    const result = await this.chatMessagesService.editMessage(
      id,
      user.id,
      message,
    );

    // Broadcast edit event to all room members
    if (result.edited_data) {
      await this.gatewayGateway.broadcastToMembers(
        result.chat_room_id,
        'messageEdited',
        result.edited_data,
      );
    }

    return { message: result.message };
  }

  /**
   * Delete (unsend) a message (only by the sender).
   * After deleting, broadcasts 'messageDeleted' to all room members.
   */
  @Delete(':id')
  @ResponseMessage('Delete message successfully')
  @ApiOperation({ summary: 'Delete a message' })
  async deleteMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
  ) {
    const result = await this.chatMessagesService.deleteMessage(id, user.id);

    // Broadcast delete event to all room members
    if (result.deleted_data) {
      await this.gatewayGateway.broadcastToMembers(
        result.chat_room_id,
        'messageDeleted',
        result.deleted_data,
      );
    }

    return { message: result.message };
  }

  /**
   * Toggle an emoji reaction on a message.
   * After toggling, broadcasts 'messageReactionUpdated' to all room members.
   */
  @Post(':id/reactions')
  @ResponseMessage('Toggle reaction successfully')
  @ApiOperation({ summary: 'Toggle emoji reaction on a message' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reaction_type: {
          type: 'string',
          enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
        },
      },
    },
  })
  async toggleReaction(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
    @Body('reaction_type') reactionType: string,
  ) {
    const result = await this.chatMessagesService.toggleReaction(
      id,
      user.id,
      reactionType as any,
    );

    // Broadcast reaction update to all room members
    await this.gatewayGateway.broadcastToMembers(
      result.chat_room_id,
      'messageReactionUpdated',
      result,
    );

    return result;
  }
}
