import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class SavePostDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID bài đăng muốn lưu' })
  post_id: string;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional({
    description:
      'ID bộ sưu tập muốn lưu vào. Nếu bỏ trống, hệ thống dùng bộ sưu tập mặc định "Đã lưu".',
  })
  save_list_id?: string;
}
