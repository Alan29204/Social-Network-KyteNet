import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateChatRoomDto {
  @IsString()
  @MaxLength(30)
  @MinLength(3)
  @IsOptional()
  @ApiProperty({ example: 'Group Chat', required: false })
  name?: string;

  @IsArray()
  @IsOptional()
  @IsUUID('all', { each: true })
  @ApiProperty({ example: ['uuid-1', 'uuid-2'], description: 'List of member IDs to add initially', required: false })
  members?: string[];
}
