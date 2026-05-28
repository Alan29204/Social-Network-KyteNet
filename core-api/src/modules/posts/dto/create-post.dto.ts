import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PrivacyType } from 'src/common/enums/privacy.enum';

export class CreatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(256)
  @MinLength(1)
  @ApiProperty({ example: 'Hello world', description: 'content' })
  content: string;

  @IsOptional()
  @ApiProperty({
    example: ['human', 'it', 'life'],
    description: 'hashtags',
  })
  hashtags: string[];

  @IsOptional()
  @ApiProperty({
    example: ['user-id-1', 'user-id-2'],
    description: 'tagged user IDs',
  })
  tagged_users: string[];

  @IsEnum(PrivacyType)
  @IsNotEmpty()
  @ApiProperty({ example: PrivacyType.PUBLIC, description: 'privacy' })
  privacy: PrivacyType;
}
