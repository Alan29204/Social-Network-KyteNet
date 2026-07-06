import { Controller, Get, Query } from '@nestjs/common';
import { SearchService, RelationFilter } from './search.service';
import {
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';

const RELATION_VALUES: RelationFilter[] = [
  'all',
  'friends',
  'following',
  'not_following',
];
const normRelation = (v?: string): RelationFilter =>
  RELATION_VALUES.includes(v as RelationFilter) ? (v as RelationFilter) : 'all';

// ── OpenAPI schemas (đủ cho orval sinh type; gồm lớp bọc { statusCode, message, data }) ──
const searchUserItemSchema = {
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
    isMutual: { type: 'boolean' },
  },
};

const searchPostItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    content: { type: 'string', nullable: true },
    medias: { type: 'array', items: { type: 'string' } },
    hashtags: { type: 'array', items: { type: 'string' } },
    privacy: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    user: searchUserItemSchema,
  },
};

const metaSchema = {
  type: 'object',
  properties: {
    page: { type: 'number' },
    limit: { type: 'number' },
    total: { type: 'number' },
    total_pages: { type: 'number' },
  },
};

const paginatedSchema = (itemSchema: object) => ({
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        data: { type: 'array', items: itemSchema },
        meta: metaSchema,
      },
    },
  },
});

const searchUsersResponseSchema = paginatedSchema(searchUserItemSchema);
const searchPostsResponseSchema = paginatedSchema(searchPostItemSchema);
const searchAllResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        users: { type: 'array', items: searchUserItemSchema },
        posts: { type: 'array', items: searchPostItemSchema },
      },
    },
  },
};

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ResponseMessage('Search results')
  @ApiOperation({ summary: 'Search users and posts (combined)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiOkResponse({ schema: searchAllResponseSchema })
  searchAll(@Query('q') query: string, @User() user: IUser) {
    return this.searchService.searchAll(query, user.id);
  }

  @Get('users')
  @ResponseMessage('Search users successfully')
  @ApiOperation({ summary: 'Search users by username/full name' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'relation',
    required: false,
    enum: RELATION_VALUES,
    description: 'Lọc theo quan hệ: all | friends | following | not_following',
  })
  @ApiOkResponse({ schema: searchUsersResponseSchema })
  searchUsers(
    @Query('q') query: string,
    @User() user: IUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('relation') relation?: string,
  ) {
    return this.searchService.searchUsers(
      query,
      Number(page) || 1,
      Number(limit) || 10,
      user.id,
      normRelation(relation),
    );
  }

  @Get('posts')
  @ResponseMessage('Search posts successfully')
  @ApiOperation({ summary: 'Search posts by content' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'relation',
    required: false,
    enum: RELATION_VALUES,
    description: 'Lọc theo quan hệ TÁC GIẢ: all | friends | following | not_following',
  })
  @ApiOkResponse({ schema: searchPostsResponseSchema })
  searchPosts(
    @Query('q') query: string,
    @User() user: IUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('relation') relation?: string,
  ) {
    return this.searchService.searchPosts(
      query,
      user.id,
      Number(page) || 1,
      Number(limit) || 10,
      normRelation(relation),
    );
  }

  @Get('hashtags')
  @ResponseMessage('Search by hashtag successfully')
  @ApiOperation({ summary: 'Search posts by hashtag' })
  @ApiQuery({ name: 'tag', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'relation',
    required: false,
    enum: RELATION_VALUES,
    description: 'Lọc theo quan hệ TÁC GIẢ: all | friends | following | not_following',
  })
  @ApiOkResponse({ schema: searchPostsResponseSchema })
  searchByHashtag(
    @Query('tag') hashtag: string,
    @User() user: IUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('relation') relation?: string,
  ) {
    return this.searchService.searchByHashtag(
      hashtag,
      user.id,
      Number(page) || 1,
      Number(limit) || 10,
      normRelation(relation),
    );
  }
}
