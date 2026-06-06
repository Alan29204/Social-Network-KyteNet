import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateChatRoomSettingsDto {
  @IsBoolean()
  @IsNotEmpty()
  @ApiProperty({ example: true, description: 'Trạng thái tắt thông báo' })
  is_muted: boolean;
}
