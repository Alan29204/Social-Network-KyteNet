import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PrivacyType } from 'src/common/enums/privacy.enum';

export class CreatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  @MinLength(1)
  @ApiProperty({ example: 'Hello world', description: 'content' })
  content: string;

  @IsOptional()
  @ApiProperty({
    example: ['human', 'it', 'life'],
    description: 'hashtags',
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((item) => item.trim());
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  hashtags: string[];

  @IsOptional()
  @ApiProperty({
    example: ['user-id-1', 'user-id-2'],
    description: 'tagged user IDs',
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((item) => item.trim());
    return value;
  })
  @IsArray()
  @IsUUID('all', { each: true })
  tagged_users: string[];

  @IsEnum(PrivacyType)
  @IsNotEmpty()
  @ApiProperty({ example: PrivacyType.PUBLIC, description: 'privacy' })
  privacy: PrivacyType;
}
