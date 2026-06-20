import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';

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
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: IUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, user, dto);
  }

  @Delete(':id')
  @ResponseMessage('Delete comment successfully')
  @ApiOperation({ summary: 'Delete comment' })
  remove(@Param('id', ParseUUIDPipe) id: string, @User() user: IUser) {
    return this.commentsService.remove(id, user);
  }
}
