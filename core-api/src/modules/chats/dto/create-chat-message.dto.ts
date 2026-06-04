import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatMessageDto {
  @IsNotEmpty()
  @IsUUID()
  @IsString()
  chat_room_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  medias: string;

  /** Optional: ID of the message being replied to */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  reply_to_id?: string;

  /** Optional: ID of the post being shared */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  shared_post_id?: string;
}
