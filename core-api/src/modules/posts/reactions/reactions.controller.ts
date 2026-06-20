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

@ApiTags('Reactions')
@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post()
  @ResponseMessage('Toggle reaction successfully')
  @ApiOperation({ summary: 'Toggle reaction (Like/Love/Haha/Wow/Sad/Angry)' })
  create(@Body() createReactionDto: CreateReactionDto, @User() user: IUser) {
    return this.reactionsService.toggle(createReactionDto, user);
  }

  @Get('summary/:postId')
  @ResponseMessage('Get reaction summary successfully')
  @ApiOperation({ summary: 'Get reaction breakdown for a post' })
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
  @ApiQuery({ name: 'reaction', required: false, enum: ReactionType })
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
    return this.reactionsService.getPostReactionUsers(
      postId,
      user,
      page,
      limit,
      reaction || ReactionType.LIKE,
    );
  }
}
