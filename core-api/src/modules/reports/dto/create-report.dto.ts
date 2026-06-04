import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReportReason, ReportType } from '../entities/report.entity';

export class CreateReportDto {
  @IsEnum(ReportType)
  @IsNotEmpty()
  @ApiProperty({ enum: ReportType, example: ReportType.POST })
  type: ReportType;

  @IsEnum(ReportReason)
  @IsNotEmpty()
  @ApiProperty({ enum: ReportReason, example: ReportReason.SPAM })
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiProperty({ required: false, example: 'This post contains spam.' })
  description?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, description: 'ID of the reported post' })
  reported_post_id?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, description: 'ID of the reported user' })
  reported_user_id?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, description: 'ID of the reported message' })
  reported_message_id?: string;
}
