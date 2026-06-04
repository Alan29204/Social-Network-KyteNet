import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SharePostDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID bài đăng gốc muốn chia sẻ' })
  post_id: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, description: 'Nội dung chia sẻ thêm' })
  content?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, description: 'Quyền riêng tư của bài viết chia sẻ', enum: ['public', 'follower', 'private'] })
  privacy?: string;
}
