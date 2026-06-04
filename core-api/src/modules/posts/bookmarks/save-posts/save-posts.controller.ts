import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SavePostsService } from './save-posts.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';
import { SavePostDto } from './dto/save-post.dto';

@ApiTags('Save Posts')
@Controller('save-posts')
export class SavePostsController {
  constructor(private readonly savePostsService: SavePostsService) {}

  @Post()
  @ResponseMessage('Save post successfully')
  @ApiOperation({ summary: 'Save a post to a list' })
  savePost(@User() user: IUser, @Body() dto: SavePostDto) {
    return this.savePostsService.savePost(user, dto.post_id, dto.save_list_id);
  }

  @Delete()
  @ResponseMessage('Unsave post successfully')
  @ApiOperation({ summary: 'Remove a saved post' })
  unsavePost(@User() user: IUser, @Body() dto: SavePostDto) {
    return this.savePostsService.unsavePost(
      user,
      dto.post_id,
      dto.save_list_id,
    );
  }

  @Get(':saveListId')
  @ResponseMessage('Get saved posts successfully')
  @ApiOperation({ summary: 'Get saved posts in a list' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  getSavedPosts(
    @Param('saveListId') saveListId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.savePostsService.getSavedPosts(
      saveListId,
      page || 1,
      limit || 10,
    );
  }
}
