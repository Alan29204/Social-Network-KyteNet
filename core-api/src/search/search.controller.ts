import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/users/users.interface';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ResponseMessage('Search results')
  @ApiOperation({ summary: 'Search users and posts (combined)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  searchAll(@Query('q') query: string, @User() user: IUser) {
    return this.searchService.searchAll(query, user.id);
  }

  @Get('users')
  @ResponseMessage('Search users successfully')
  @ApiOperation({ summary: 'Search users by username/email' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  searchUsers(
    @Query('q') query: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.searchUsers(query, page || 1, limit || 10);
  }

  @Get('posts')
  @ResponseMessage('Search posts successfully')
  @ApiOperation({ summary: 'Search posts by content' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  searchPosts(
    @Query('q') query: string,
    @User() user: IUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.searchPosts(query, user.id, page || 1, limit || 10);
  }

  @Get('hashtags')
  @ResponseMessage('Search by hashtag successfully')
  @ApiOperation({ summary: 'Search posts by hashtag' })
  @ApiQuery({ name: 'tag', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  searchByHashtag(
    @Query('tag') hashtag: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.searchByHashtag(hashtag, page || 1, limit || 10);
  }
}
