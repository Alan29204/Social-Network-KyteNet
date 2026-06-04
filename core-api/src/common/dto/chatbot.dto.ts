import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ChatbotDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Hãy viết một bài đăng chào mừng' })
  prompt: string;
}
