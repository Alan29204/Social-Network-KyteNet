import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ReportAction, ReportStatus } from '../../reports/entities/report.entity';

export class ResolveReportDto {
  @IsEnum([ReportStatus.RESOLVED, ReportStatus.REJECTED])
  @IsNotEmpty()
  @ApiProperty({
    enum: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
    description: 'Trạng thái giải quyết báo cáo',
  })
  status: ReportStatus;

  @IsEnum(ReportAction)
  @IsNotEmpty()
  @ApiProperty({
    enum: ReportAction,
    example: ReportAction.WARN_REPORTED,
    description: 'Hành động xử lý nội dung/tài khoản sau khi duyệt báo cáo',
  })
  admin_action: ReportAction;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Bài viết vi phạm tiêu chuẩn cộng đồng.',
    description: 'Ghi chú của admin',
  })
  admin_note: string;
}
