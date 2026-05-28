import { Body, Controller, Post } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from '../users/users.interface';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ResponseMessage('Report submitted successfully')
  @ApiOperation({ summary: 'Report a post or user' })
  createReport(@Body() dto: CreateReportDto, @User() user: IUser) {
    return this.reportsService.createReport(dto, user);
  }
}
