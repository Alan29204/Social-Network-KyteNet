import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';

@ApiTags('Stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @ResponseMessage('Tạo story thành công')
  @ApiOperation({ summary: 'Tạo story (ảnh/video hoặc text)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        background: { type: 'string' },
        privacy: { type: 'string', enum: ['public', 'follower', 'private'] },
        'media-story': { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('media-story'))
  create(
    @User() user: IUser,
    @Body() dto: CreateStoryDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/ })
        .addMaxSizeValidator({ maxSize: 1024 * 1024 * 20 }) // 20MB
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ) {
    return this.storiesService.create(user, dto, file);
  }

  @Get('feed')
  @ResponseMessage('Lấy story feed thành công')
  @ApiOperation({ summary: 'Lấy story của bản thân + người đang follow' })
  getFeed(@User() user: IUser) {
    return this.storiesService.getFeed(user);
  }

  @Get('user/:userId')
  @ResponseMessage('Lấy story của user thành công')
  @ApiOperation({ summary: 'Lấy story còn hạn của một user' })
  getUserStories(@Param('userId') userId: string) {
    if (!isUUID(userId)) {
      throw new BadRequestException(`Invalid user ID: ${userId}`);
    }
    return this.storiesService.getUserStories(userId);
  }

  @Post(':id/view')
  @ResponseMessage('Đã đánh dấu xem story')
  @ApiOperation({ summary: 'Đánh dấu đã xem story' })
  markViewed(@Param('id') id: string, @User() user: IUser) {
    return this.storiesService.markViewed(id, user);
  }

  @Get(':id/viewers')
  @ResponseMessage('Danh sách người xem story')
  @ApiOperation({ summary: 'Lấy danh sách người đã xem (chỉ chủ story)' })
  getViewers(@Param('id') id: string, @User() user: IUser) {
    return this.storiesService.getViewers(id, user);
  }

  @Delete(':id')
  @ResponseMessage('Xóa story thành công')
  @ApiOperation({ summary: 'Xóa story' })
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.storiesService.remove(id, user);
  }
}
