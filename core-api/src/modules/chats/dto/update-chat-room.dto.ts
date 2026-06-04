import { ApiProperty } from '@nestjs/swagger';
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

  @IsString()
  @MaxLength(30)
  @MinLength(3)
  @IsNotEmpty()
  @ApiProperty({ example: 'Group Chat' })
  name: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'File ảnh đại diện phòng chat',
  })
  @IsOptional()
  'avatar-chat-room'?: any;
}
