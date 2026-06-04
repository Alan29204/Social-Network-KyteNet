import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus, ReportType } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { IUser } from '../users/users.interface';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
  ) {}

  async createReport(dto: CreateReportDto, user: IUser) {
    if (dto.type === ReportType.POST && !dto.reported_post_id) {
      throw new BadRequestException('reported_post_id is required when type is post');
    }
    if (dto.type === ReportType.USER && !dto.reported_user_id) {
      throw new BadRequestException('reported_user_id is required when type is user');
    }
    if (dto.type === ReportType.MESSAGE && !dto.reported_message_id) {
      throw new BadRequestException('reported_message_id is required when type is message');
    }

    try {
      const report = this.reportsRepository.create({
        type: dto.type,
        reason: dto.reason,
        description: dto.description,
        reporter_id: user.id,
        reported_post_id: dto.reported_post_id,
        reported_user_id: dto.reported_user_id,
        reported_message_id: dto.reported_message_id,
        status: ReportStatus.PENDING,
      });
      await this.reportsRepository.save(report);
      return { message: 'Report submitted successfully', report_id: report.id };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create report');
    }
  }

  async listReports(status?: ReportStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = this.reportsRepository.createQueryBuilder('report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.reported_post', 'reported_post')
      .leftJoinAndSelect('report.reported_user', 'reported_user')
      .leftJoinAndSelect('report.reported_message', 'reported_message')
      .orderBy('report.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      query.where('report.status = :status', { status });
    }

    const [reports, total] = await query.getManyAndCount();
    return {
      data: reports,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async resolveReport(id: string, admin_note: string, status: ReportStatus) {
    const report = await this.reportsRepository.findOneBy({ id });
    if (!report) throw new NotFoundException('Report not found');

    if (status !== ReportStatus.RESOLVED && status !== ReportStatus.REJECTED) {
      throw new BadRequestException('Status must be resolved or rejected');
    }

    await this.reportsRepository.update(id, { status, admin_note });
    return { message: `Report ${status} successfully` };
  }
}
