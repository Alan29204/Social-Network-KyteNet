import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Reactions')
@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post()
  @ResponseMessage('Toggle reaction successfully')
  @ApiOperation({ summary: 'Toggle reaction (Like/Love/Haha/Wow/Sad/Angry)' })
  create(@Body() createReactionDto: CreateReactionDto, @User() user: IUser) {
    return this.reactionsService.toggle(createReactionDto, user);
  }

  @Get('summary/:postId')
  @ResponseMessage('Get reaction summary successfully')
  @ApiOperation({ summary: 'Get reaction breakdown for a post' })
  getReactionSummary(@Param('postId') postId: string) {
    return this.reactionsService.getReactionSummary(postId);
  }
}
