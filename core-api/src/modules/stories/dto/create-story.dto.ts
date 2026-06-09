import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrivacyType } from 'src/common/enums/privacy.enum';

export class CreateStoryDto {
  @ApiPropertyOptional({ description: 'Nội dung text cho story dạng text' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @ApiPropertyOptional({
    description: 'Màu nền (hex hoặc gradient) cho story text',
  })
  @IsOptional()
  @IsString()
  background?: string;

  @ApiPropertyOptional({ enum: PrivacyType, default: PrivacyType.PUBLIC })
  @IsOptional()
  @IsEnum(PrivacyType)
  privacy?: PrivacyType;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'File ảnh hoặc video của story',
  })
  @IsOptional()
  'media-story'?: any;
}
