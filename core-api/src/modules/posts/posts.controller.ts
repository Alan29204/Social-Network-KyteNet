import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  HttpStatus,
  ParseFilePipeBuilder,
  UploadedFiles,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SharePostDto } from './dto/share-post.dto';
import { IUser } from 'src/modules/users/users.interface';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Doc } from 'src/common/decorators/doc.decorator';
import { OptionalUuidPipe } from 'src/common/pipes/optional-uuid.pipe';

const postMutationResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        post: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  },
};

const deletePostResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        post_id: { type: 'string', format: 'uuid' },
      },
    },
  },
};

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ResponseMessage('Fetch posts feed successfully')
  @ApiOperation({ summary: 'Get posts by user (profile page)' })
  @Doc({
    summary: 'Get posts by user',
    request: {
      queries: [
        { name: 'page', description: 'Page number', required: false },
        { name: 'limit', description: 'Limit per page', required: false },
        { name: 'user_id', description: 'User ID', required: false },
        {
          name: 'is_repost',
          description: 'Filter by repost status',
          required: false,
          type: 'boolean',
        },
        {
          name: 'media_type',
          description: 'Filter by media type (image/video)',
          required: false,
        },
      ],
    },
  })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('user_id', new OptionalUuidPipe()) user_id?: string,
    @Query('is_repost') is_repost?: string,
    @Query('media_type') media_type?: 'image' | 'video',
    @User() user?: IUser,
  ) {
    const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
    const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 10));

    return this.postsService.findAll(
      normalizedPage,
      normalizedLimit,
      user_id,
      is_repost === 'true' ? true : is_repost === 'false' ? false : undefined,
      media_type,
      user,
    );
  }

  @Post()
  @ResponseMessage('Create post successfully')
  @ApiOperation({ summary: 'Create post' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Create post successfully',
    schema: postMutationResponseSchema,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        privacy: { type: 'string', enum: ['public', 'follower', 'private'] },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
        },
        tagged_users: {
          type: 'array',
          items: { type: 'string' },
        },
        'medias-posts': {
          type: 'array',
          description:
            'Ảnh/video đính kèm. Tối đa 15 tệp (trong đó tối đa 5 video). Chỉ nhận image/* hoặc video/*. Ảnh ≤10MB, video ≤100MB.',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @Doc({
    summary: 'Create post',
    request: {
      bodyType: 'FORM_DATA',
    },
  })
  @UseInterceptors(FilesInterceptor('medias-posts', 15))
  create(
    @User() user: IUser,
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /^(image|video)\/(jpg|jpeg|png|gif|webp|mp4|mov|quicktime|webm)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 100, // 100MB (đủ cho video; ảnh do FE chặn 10MB)
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file: Express.Multer.File[],
  ) {
    return this.postsService.create(user, createPostDto, file);
  }

  @Get(':id')
  @ResponseMessage('Find post by id successfully')
  @ApiOperation({ summary: 'Find post by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser) {
    return this.postsService.findOne(user, id);
  }

  @Post('share')
  @ResponseMessage('Share post successfully')
  @ApiOperation({ summary: 'Share/Repost a post' })
  sharePost(@User() user: IUser, @Body() dto: SharePostDto) {
    return this.postsService.sharePost(
      user,
      dto.post_id,
      dto.content,
      dto.privacy,
    );
  }

  @Patch()
  @ResponseMessage('Cập nhật bài viết thành công')
  @ApiOperation({ summary: 'Cập nhật bài viết' })
  @ApiBody({ type: UpdatePostDto })
  @ApiResponse({
    status: 200,
    description: 'Update post successfully',
    schema: postMutationResponseSchema,
  })
  update(@User() user: IUser, @Body() dto: UpdatePostDto) {
    return this.postsService.update(user, dto);
  }

  @Delete(':id')
  @ResponseMessage('Xóa bài viết thành công')
  @ApiOperation({ summary: 'Xóa bài viết' })
  @ApiResponse({
    status: 200,
    description: 'Delete post successfully',
    schema: deletePostResponseSchema,
  })
  remove(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser) {
    return this.postsService.remove(id, user);
  }

  @Post(':id/remove-tag')
  @ResponseMessage('Gỡ thẻ thành công')
  @ApiOperation({ summary: 'Gỡ thẻ người dùng khỏi bài viết' })
  @Doc({
    summary: 'Remove tag from post',
  })
  removeTag(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser) {
    return this.postsService.removeTag(id, user.id);
  }
}
