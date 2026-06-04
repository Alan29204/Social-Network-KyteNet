import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ReportStatus } from '../../reports/entities/report.entity';

export class ResolveReportDto {
  @IsEnum([ReportStatus.RESOLVED, ReportStatus.REJECTED])
  @IsNotEmpty()
  @ApiProperty({
    enum: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
    description: 'Trạng thái giải quyết báo cáo',
  })
  status: ReportStatus;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Bài viết vi phạm tiêu chuẩn cộng đồng.',
    description: 'Ghi chú của admin',
  })
  admin_note: string;
}
