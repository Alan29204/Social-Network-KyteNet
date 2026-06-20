import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Nội dung bình luận đã chỉnh sửa' })
  content: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ApiProperty({
    example: ['user-id-1', 'user-id-2'],
    description: 'tagged user IDs',
    required: false,
  })
  tagged_users?: string[];
}
