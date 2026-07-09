import {
  Controller,
  Get,
  Post,
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
   * Get the "Explore" feed (Khám phá) — public posts ranked by engagement score.
   * Uses cursor-based pagination for infinite scroll.
   */
  @Get('explore')
  @ApiOperation({ summary: 'Get Explore Feed (khám phá liên tục)' })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getExploreFeed(
    @User() user: IUser,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    return this.feedService.getExploreFeed(user.id, cursor, limit);
  }

  /**
   * Force-refresh the Explore feed ordering ("tap to refresh" / pull-to-refresh).
   * Rebuilds the personalized ranking with a light shuffle so the order changes.
   */
  @Post('explore/refresh')
  @ApiOperation({ summary: 'Refresh (reshuffle) the Explore feed ranking' })
  refreshExplore(@User() user: IUser) {
    return this.feedService.refreshExploreRanking(user.id);
  }
}
