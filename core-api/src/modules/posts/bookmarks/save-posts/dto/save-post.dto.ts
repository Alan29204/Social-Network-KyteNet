import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class SavePostDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID bài đăng muốn lưu' })
  post_id: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID bộ sưu tập muốn lưu vào' })
  save_list_id: string;
}
