import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';

@Controller('feed')
@ApiTags('Feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * Get the "Following" feed — posts from users the current user follows.
   * Uses cursor-based pagination for infinite scroll.
   */
  @Get('following')
  @ApiOperation({ summary: 'Get Following Feed (cursor-based)' })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFollowingFeed(
    @User() user: IUser,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    const cursorNum = cursor ? Number(cursor) : undefined;
    return this.feedService.getFollowingFeed(user.id, cursorNum, limit);
  }

  /**
   * Get the "For You" feed — public posts ranked by engagement score.
   * Uses cursor-based pagination for infinite scroll.
   */
  @Get('foryou')
  @ApiOperation({ summary: 'Get For You Feed (ranked by engagement)' })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getForYouFeed(
    @User() user: IUser,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    const cursorNum = cursor ? Number(cursor) : undefined;
    return this.feedService.getForYouFeed(user.id, cursorNum, limit);
  }
}
