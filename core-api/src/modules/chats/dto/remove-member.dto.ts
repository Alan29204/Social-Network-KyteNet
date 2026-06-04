import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class RemoveMemberDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID phòng chat' })
  chat_room_id: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID thành viên muốn xóa' })
  target_user_id: string;
}
