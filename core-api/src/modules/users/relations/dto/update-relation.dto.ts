import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { RelationType } from 'src/common/enums/relation.enum';

export class UpdateRelationDto {
  @IsUUID()
  @ApiProperty({ example: '123123123123', description: 'ID user other' })
  @IsNotEmpty()
  user_id: string;

  @IsEnum(RelationType)
  @ApiProperty({ example: RelationType.FOLLOWING })
  @IsOptional()
  relation?: RelationType;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'restrict', description: 'Action to perform: restrict, unrestrict', required: false })
  action?: 'restrict' | 'unrestrict';
}
