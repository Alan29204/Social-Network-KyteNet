import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateChatRoomDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @MinLength(3)
  @ApiPropertyOptional({ example: 'Group Chat' })
  name?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'File ảnh đại diện phòng chat',
  })
  @IsOptional()
  'avatar-chat-room'?: any;
}
