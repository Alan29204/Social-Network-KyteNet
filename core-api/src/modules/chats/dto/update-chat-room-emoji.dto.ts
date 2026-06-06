import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateChatRoomEmojiDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: '👍',
    description: 'Biểu tượng cảm xúc nhanh của phòng chat',
  })
  emoji: string;
}
