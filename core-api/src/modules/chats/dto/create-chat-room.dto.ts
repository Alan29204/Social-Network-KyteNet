import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { MemberType } from 'src/common/enums/member.enum';

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

  @IsEnum(MemberType)
  @IsOptional()
  @ApiProperty({
    enum: MemberType,
    required: false,
    description: 'Quyền thêm thành viên cho nhóm (mặc định admin). "admin" = chỉ quản trị viên; "member" = mọi thành viên.',
  })
  permission_add_member?: MemberType;
}
