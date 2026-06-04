import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ example: 'user@example.com', description: 'Email tài khoản' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '123456', description: 'Mã xác thực OTP gửi qua email' })
  reset_code: string;

  @IsNotEmpty()
  @MinLength(6)
  @ApiProperty({ example: 'newpassword123', description: 'Mật khẩu mới' })
  new_password: string;
}
