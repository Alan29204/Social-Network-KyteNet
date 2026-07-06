import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendRegisterOtpDto {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'user@gmail.com', description: 'Email cần xác thực' })
  email: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'nguyenvana',
    description: 'Tên đăng nhập cần kiểm tra trùng trước khi gửi OTP',
    required: false,
  })
  username?: string;
}
