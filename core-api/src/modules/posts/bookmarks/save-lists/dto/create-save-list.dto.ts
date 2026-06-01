import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSaveListDto {
  @ApiProperty({ description: 'Tên bộ sưu tập', example: 'Món ngon mỗi ngày' })
  @IsNotEmpty({ message: 'Tên bộ sưu tập không được để trống' })
  @IsString()
  @MaxLength(100, { message: 'Tên bộ sưu tập không được vượt quá 100 ký tự' })
  name: string;
}
