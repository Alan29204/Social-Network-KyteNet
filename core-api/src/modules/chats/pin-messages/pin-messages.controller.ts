import { Controller, Param, Patch } from '@nestjs/common';
import { PinMessagesService } from './pin-messages.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';

@ApiTags('pin-messages')
@Controller('pin-messages')
export class PinMessagesController {
  constructor(private readonly pinMessagesService: PinMessagesService) {}

  @Patch(':messageId')
  @ResponseMessage('Toggle pin message successfully')
  @ApiOperation({ summary: 'Pin or unpin a message' })
  togglePinMessage(@Param('messageId') messageId: string, @User() user: IUser) {
    return this.pinMessagesService.togglePinMessage(messageId, user.id);
  }
}
