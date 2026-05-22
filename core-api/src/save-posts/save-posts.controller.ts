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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/users/users.interface';

@ApiTags('Save Posts')
@Controller('save-posts')
export class SavePostsController {
  constructor(private readonly savePostsService: SavePostsService) {}

  @Post()
  @ResponseMessage('Save post successfully')
  @ApiOperation({ summary: 'Save a post to a list' })
  savePost(
    @User() user: IUser,
    @Body() body: { post_id: string; save_list_id: string },
  ) {
    return this.savePostsService.savePost(user, body.post_id, body.save_list_id);
  }

  @Delete()
  @ResponseMessage('Unsave post successfully')
  @ApiOperation({ summary: 'Remove a saved post' })
  unsavePost(
    @User() user: IUser,
    @Body() body: { post_id: string; save_list_id: string },
  ) {
    return this.savePostsService.unsavePost(
      user,
      body.post_id,
      body.save_list_id,
    );
  }

  @Get(':saveListId')
  @ResponseMessage('Get saved posts successfully')
  @ApiOperation({ summary: 'Get saved posts in a list' })
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
