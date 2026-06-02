import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Content of the comment' })
  content: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID of the post to comment on' })
  post_id: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'ID of the parent comment if this is a reply', required: false })
  parent_id?: string;

  @IsOptional()
  @ApiProperty({
    example: ['user-id-1', 'user-id-2'],
    description: 'tagged user IDs',
    required: false,
  })
  tagged_users?: string[];
}
