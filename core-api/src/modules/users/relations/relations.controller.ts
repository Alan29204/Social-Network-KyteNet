import {
  Controller,
  Post,
  Body,
  Get,
  BadRequestException,
  Param,
  Query,
  forwardRef,
  Inject,
  Delete,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User, ResponseMessage } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';
import { RelationType } from 'src/common/enums/relation.enum';
import { RelationsService } from './relations.service';
import { UpdateRelationDto } from './dto/update-relation.dto';
import { UsersService } from 'src/modules/users/users.service';

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
    @Param('user_id') user_id: string,
    @Query('relation') relation: RelationType,
    @Query('mode') mode?: 'followers' | 'following',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const privacy = await this.usersService.privacySeeProfile(user.id, user_id);
    if (!privacy) {
      throw new BadRequestException('You are not allowed to see this list');
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
  async removeFollower(@User() user: IUser, @Param('id') followerId: string) {
    return this.relationShipsService.removeFollower(user.id, followerId);
  }

  @Get('suggested')
  @ResponseMessage('Get suggested users successfully')
  @ApiOperation({ summary: 'Get suggested users based on mutual followers' })
  async getSuggestedUsers(
    @User() user: IUser,
    @Query('limit') limit: number = 5,
  ) {
    return this.relationShipsService.getSuggestedUsers(user.id, limit);
  }

  @Post('block')
  @ResponseMessage('User blocked successfully')
  @ApiOperation({ summary: 'Block a user (absolute override)' })
  blockUser(@User() user: IUser, @Body() body: { user_id: string }) {
    if (!body?.user_id) {
      throw new BadRequestException('user_id is required');
    }
    return this.relationShipsService.blockUser(user, body.user_id);
  }

  @Post('unblock')
  @ResponseMessage('User unblocked successfully')
  @ApiOperation({ summary: 'Unblock a user (does not restore follow)' })
  unblockUser(@User() user: IUser, @Body() body: { user_id: string }) {
    if (!body?.user_id) {
      throw new BadRequestException('user_id is required');
    }
    return this.relationShipsService.unblockUser(user, body.user_id);
  }

  @Get('blocked/list')
  @ResponseMessage('Get blocked users successfully')
  @ApiOperation({ summary: 'Get list of users you have blocked' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
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
  acceptFollowRequest(@User() user: IUser, @Body() body: { user_id: string }) {
    if (!body?.user_id) {
      throw new BadRequestException('user_id is required');
    }
    return this.relationShipsService.acceptFollowRequest(user, body.user_id);
  }

  @Post('requests/reject')
  @ResponseMessage('Follow request rejected successfully')
  @ApiOperation({ summary: 'Reject a follow request' })
  rejectFollowRequest(@User() user: IUser, @Body() body: { user_id: string }) {
    if (!body?.user_id) {
      throw new BadRequestException('user_id is required');
    }
    return this.relationShipsService.rejectFollowRequest(user, body.user_id);
  }

  @Get(':user_id')
  @ResponseMessage('Get relation between 2 users successfully')
  @ApiOperation({ summary: 'Get relation between 2 users' })
  async getRelation(@User() user: IUser, @Param('user_id') user_id: string) {
    const relation = await this.relationShipsService.getRelation(
      user.id,
      user_id,
    );

    return relation;
  }

  @Post('update')
  @ResponseMessage('Update relation successfully')
  @ApiOperation({ summary: 'Update relation' })
  updateRelation(@User() user: IUser, @Body() dto: UpdateRelationDto) {
    return this.relationShipsService.updateRelation(user, dto);
  }
}
