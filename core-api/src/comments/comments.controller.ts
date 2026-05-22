import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/users/users.interface';

@Controller('comments')
@ApiTags('Comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ResponseMessage('Create comment successfully')
  @ApiOperation({ summary: 'Create comment' })
  @ApiBody({ type: CreateCommentDto })
  create(@User() user: IUser, @Body() createCommentDto: CreateCommentDto) {
    return this.commentsService.create(user, createCommentDto);
  }

  @Patch(':id')
  @ResponseMessage('Update comment successfully')
  @ApiOperation({ summary: 'Update comment' })
  update(
    @Param('id') id: string,
    @User() user: IUser,
    @Body('content') content: string,
  ) {
    return this.commentsService.update(id, user, content);
  }

  @Delete(':id')
  @ResponseMessage('Delete comment successfully')
  @ApiOperation({ summary: 'Delete comment' })
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.commentsService.remove(id, user);
  }
}
