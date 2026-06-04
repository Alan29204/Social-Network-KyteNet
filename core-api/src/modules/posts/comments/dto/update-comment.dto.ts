import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Nội dung bình luận đã chỉnh sửa' })
  content: string;

  @IsOptional()
  @ApiProperty({
    example: ['user-id-1', 'user-id-2'],
    description: 'tagged user IDs',
    required: false,
  })
  tagged_users?: string[];
}
