import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UserIdDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: 'Target user ID' })
  user_id: string;
}
