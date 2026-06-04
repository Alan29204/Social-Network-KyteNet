import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AddMembersDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID phòng chat' })
  chat_room_id: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsNotEmpty()
  @ApiProperty({
    type: [String],
    description: 'Danh sách các ID người dùng muốn thêm',
  })
  user_ids: string[];
}
