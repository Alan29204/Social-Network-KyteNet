import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Content of the comment' })
  content: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'ID of the post to comment on' })
  post_id: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID of the parent comment if this is a reply',
    required: false,
  })
  parent_id?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string')
      return value.split(',').map((item) => item.trim());
    return value;
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ApiProperty({
    example: ['user-id-1', 'user-id-2'],
    description: 'tagged user IDs',
    required: false,
  })
  tagged_users?: string[];
}
