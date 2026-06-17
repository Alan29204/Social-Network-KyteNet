import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PrivacyType } from 'src/common/enums/privacy.enum';

export class UpdatePostDto {
  // @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    example: '452a1e21-d4eb-4f14-a52f-fbfaf0bb7d99',
    description: 'id',
  })
  id: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  @MinLength(0)
  @ApiProperty({ example: 'Hello world', description: 'content' })
  content: string;

  @IsOptional()
  @ApiProperty({
    example: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
    description: 'medias',
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((item) => item.trim());
    return value;
  })
  @IsArray()
  medias: string[];

  @IsEnum(PrivacyType)
  @IsNotEmpty()
  @ApiProperty({ example: PrivacyType.PUBLIC, description: 'privacy' })
  privacy: PrivacyType;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((item) => item.trim());
    return value;
  })
  @IsArray()
  @ApiProperty({ example: ['uuid1', 'uuid2'], description: 'tagged_users', required: false })
  tagged_users?: string[];
}
