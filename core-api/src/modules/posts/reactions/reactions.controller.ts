import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReactionType } from 'src/common/enums/reaction.enum';

const reactionUsersResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              username: { type: 'string' },
              full_name: { type: 'string', nullable: true },
              avatar: { type: 'string', nullable: true },
              reaction: { type: 'string', enum: Object.values(ReactionType) },
              reacted_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            last_page: { type: 'number' },
          },
        },
      },
    },
  },
};

const reactionToggleResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        reaction: {
          type: 'string',
          enum: Object.values(ReactionType),
          nullable: true,
        },
      },
    },
  },
};

const reactionSummaryResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        breakdown: {
          type: 'object',
          additionalProperties: { type: 'number' },
          description: 'Đếm theo loại, vd { like: 10, love: 3, haha: 1 }',
        },
      },
    },
  },
};

@ApiTags('Reactions')
@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post()
  @ResponseMessage('Toggle reaction successfully')
  @ApiOperation({ summary: 'Toggle reaction (Like/Love/Haha/Wow/Sad/Angry)' })
  @ApiResponse({
    status: 201,
    description: 'Toggle reaction result',
    schema: reactionToggleResponseSchema,
  })
  create(@Body() createReactionDto: CreateReactionDto, @User() user: IUser) {
    return this.reactionsService.toggle(createReactionDto, user);
  }

  @Get('summary/:postId')
  @ResponseMessage('Get reaction summary successfully')
  @ApiOperation({ summary: 'Get reaction breakdown for a post' })
  @ApiResponse({
    status: 200,
    description: 'Reaction breakdown for a post',
    schema: reactionSummaryResponseSchema,
  })
  getReactionSummary(
    @Param('postId', ParseUUIDPipe) postId: string,
    @User() user: IUser,
  ) {
    return this.reactionsService.getReactionSummary(postId, user);
  }

  @Get('posts/:postId/users')
  @ResponseMessage('Get post reaction users successfully')
  @ApiOperation({ summary: 'Get users who reacted to a post' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'reaction',
    required: false,
    enum: ReactionType,
    description: 'Lọc theo 1 loại; bỏ trống = tab "Tất cả" (mọi loại)',
  })
  @ApiResponse({
    status: 200,
    description: 'Get users who reacted to a post',
    schema: reactionUsersResponseSchema,
  })
  getPostReactionUsers(
    @Param('postId', ParseUUIDPipe) postId: string,
    @User() user: IUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('reaction') reaction?: ReactionType,
  ) {
    // Không truyền reaction -> trả tất cả loại (tab "Tất cả").
    return this.reactionsService.getPostReactionUsers(
      postId,
      user,
      page,
      limit,
      reaction,
    );
  }
}
