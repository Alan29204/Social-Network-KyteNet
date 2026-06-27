import {
  Controller,
  Post,
  Body,
  Get,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  Query,
  forwardRef,
  Inject,
  Delete,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User, ResponseMessage } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';
import { RelationType } from 'src/common/enums/relation.enum';
import { RelationsService } from './relations.service';
import { UpdateRelationDto } from './dto/update-relation.dto';
import { UsersService } from 'src/modules/users/users.service';
import { UserIdDto } from './dto/user-id.dto';

const relationUserSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    username: { type: 'string' },
    full_name: { type: 'string', nullable: true },
    avatar: { type: 'string', nullable: true },
    privacy: { type: 'string', enum: ['public', 'private', 'follower'] },
    relationStatus: {
      type: 'string',
      enum: ['none', 'following', 'pending', 'block'],
    },
    isFollowing: { type: 'boolean' },
  },
};

const relationUpdateResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        relationStatus: {
          type: 'string',
          enum: ['none', 'following', 'pending', 'block'],
        },
        isFollowing: { type: 'boolean' },
        user: relationUserSchema,
      },
    },
  },
};

const relationListResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        limit: { type: 'number' },
        total: { type: 'number' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user: relationUserSchema,
              requested_at: { type: 'string', format: 'date-time' },
              blocked_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
};

const suggestedUsersResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'array',
      items: {
        ...relationUserSchema,
        properties: {
          ...relationUserSchema.properties,
          mutual_count: { type: 'number' },
          mutual_friends: {
            type: 'array',
            items: relationUserSchema,
          },
        },
      },
    },
  },
};

@ApiTags('Relations')
@Controller('relations')
export class RelationsController {
  constructor(
    private readonly relationShipsService: RelationsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  @ResponseMessage(
    `Get list relation ['following', 'block'] of user successfully`,
  )
  @Get('friends/:user_id')
  @ApiOperation({
    summary: `Get list relation ['following', 'block'] of user`,
  })
  @ApiQuery({
    name: 'relation',
    enum: RelationType,
    required: true,
    description: 'Kiểu quan hệ bạn bè',
  })
  @ApiQuery({
    name: 'mode',
    enum: ['followers', 'following'],
    required: false,
    description: 'Chế độ xem followers hoặc following',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Số trang (mặc định: 1)',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Số lượng phần tử mỗi trang (mặc định: 10)',
  })
  async getListRelation(
    @User() user: IUser,
    @Param('user_id', ParseUUIDPipe) user_id: string,
    @Query('relation') relation: RelationType,
    @Query('mode') mode?: 'followers' | 'following',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const privacy = await this.usersService.privacySeeProfile(user.id, user_id);
    if (!privacy) {
      throw new ForbiddenException('You are not allowed to see this list');
    }
    return this.relationShipsService.getListRelation(
      user_id,
      page,
      limit,
      relation,
      mode,
    );
  }

  @Delete('follower/:id')
  @ResponseMessage('Remove follower successfully')
  @ApiOperation({ summary: 'Remove a user from your followers list' })
  async removeFollower(
    @User() user: IUser,
    @Param('id', ParseUUIDPipe) followerId: string,
  ) {
    return this.relationShipsService.removeFollower(user.id, followerId);
  }

  @Get('suggested')
  @ResponseMessage('Get suggested users successfully')
  @ApiOperation({ summary: 'Get suggested users based on mutual followers' })
  @ApiResponse({
    status: 200,
    description: 'Get suggested users successfully',
    schema: suggestedUsersResponseSchema,
  })
  async getSuggestedUsers(
    @User() user: IUser,
    @Query('limit') limit: number = 5,
  ) {
    return this.relationShipsService.getSuggestedUsers(user.id, limit);
  }

  @Post('block')
  @ResponseMessage('User blocked successfully')
  @ApiOperation({ summary: 'Block a user (absolute override)' })
  blockUser(@User() user: IUser, @Body() dto: UserIdDto) {
    return this.relationShipsService.blockUser(user, dto.user_id);
  }

  @Post('unblock')
  @ResponseMessage('User unblocked successfully')
  @ApiOperation({ summary: 'Unblock a user (does not restore follow)' })
  unblockUser(@User() user: IUser, @Body() dto: UserIdDto) {
    return this.relationShipsService.unblockUser(user, dto.user_id);
  }

  @Get('blocked/list')
  @ResponseMessage('Get blocked users successfully')
  @ApiOperation({ summary: 'Get list of users you have blocked' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({
    status: 200,
    description: 'Get blocked users successfully',
    schema: relationListResponseSchema,
  })
  async getBlockedUsers(
    @User() user: IUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.relationShipsService.getBlockedUsers(user.id, page, limit);
  }

  @Get('requests/pending')
  @ResponseMessage('Get pending follow requests successfully')
  @ApiOperation({ summary: 'Get list of pending follow requests' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({
    status: 200,
    description: 'Get pending follow requests successfully',
    schema: relationListResponseSchema,
  })
  async getPendingRequests(
    @User() user: IUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.relationShipsService.getPendingRequests(user.id, page, limit);
  }

  @Post('requests/accept')
  @ResponseMessage('Follow request accepted successfully')
  @ApiOperation({ summary: 'Accept a follow request' })
  acceptFollowRequest(@User() user: IUser, @Body() dto: UserIdDto) {
    return this.relationShipsService.acceptFollowRequest(user, dto.user_id);
  }

  @Post('requests/reject')
  @ResponseMessage('Follow request rejected successfully')
  @ApiOperation({ summary: 'Reject a follow request' })
  rejectFollowRequest(@User() user: IUser, @Body() dto: UserIdDto) {
    return this.relationShipsService.rejectFollowRequest(user, dto.user_id);
  }

  @Get('block-status/:user_id')
  @ResponseMessage('Get block status successfully')
  @ApiOperation({
    summary: 'Kiểm tra có quan hệ chặn (2 chiều) với user hay không',
  })
  async getBlockStatus(
    @User() user: IUser,
    @Param('user_id', ParseUUIDPipe) user_id: string,
  ) {
    const is_blocked = await this.relationShipsService.areBlocked(
      user.id,
      user_id,
    );
    return { is_blocked };
  }

  @Get(':user_id')
  @ResponseMessage('Get relation between 2 users successfully')
  @ApiOperation({ summary: 'Get relation between 2 users' })
  async getRelation(
    @User() user: IUser,
    @Param('user_id', ParseUUIDPipe) user_id: string,
  ) {
    const relation = await this.relationShipsService.getRelation(
      user.id,
      user_id,
    );

    return relation;
  }

  @Post('update')
  @ResponseMessage('Update relation successfully')
  @ApiOperation({ summary: 'Update relation' })
  @ApiResponse({
    status: 201,
    description: 'Update relation successfully',
    schema: relationUpdateResponseSchema,
  })
  updateRelation(@User() user: IUser, @Body() dto: UpdateRelationDto) {
    return this.relationShipsService.updateRelation(user, dto);
  }
}
