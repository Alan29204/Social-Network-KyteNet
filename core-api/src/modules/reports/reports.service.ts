import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Report,
  ReportAction,
  ReportStatus,
  ReportType,
} from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { IUser } from '../users/users.interface';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import { ChatMessage } from '../chats/entities/chat-message.entity';
import { NotificationService } from '../notifications/notifications.service';
import { DeviceSessionsService } from '../users/device-sessions/device-sessions.service';
import { RoleType } from 'src/common/enums/role.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ChatMessage)
    private readonly _chatMessageRepository: Repository<ChatMessage>,
    private readonly notificationService: NotificationService,
    private readonly deviceSessionsService: DeviceSessionsService,
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
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (page - 1) * limit;

    const query = this.buildReportDetailQuery()
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

  async getReportDetail(id: string) {
    const report = await this.buildReportDetailQuery()
      .where('report.id = :id', { id })
      .getOne();

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async resolveReport(
    id: string,
    adminId: string,
    admin_note: string,
    status: ReportStatus,
    admin_action: ReportAction,
  ) {
    const report = await this.getReportDetail(id);

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report has already been processed');
    }

    if (status !== ReportStatus.RESOLVED && status !== ReportStatus.REJECTED) {
      throw new BadRequestException('Status must be resolved or rejected');
    }

    if (status === ReportStatus.REJECTED && admin_action !== ReportAction.NO_ACTION) {
      throw new BadRequestException('Rejected reports must use no_action');
    }

    if (status === ReportStatus.RESOLVED) {
      await this.applyReportAction(report, admin_action);
    }

    await this.reportsRepository.update(id, {
      status,
      admin_note,
      admin_action,
      resolved_by: adminId,
      resolved_at: new Date(),
    });

    await this.notifyReporter(report, status, admin_action, admin_note);

    const updatedReport = await this.getReportDetail(id);
    return {
      message: `Report ${status} successfully`,
      report: updatedReport,
    };
  }

  private buildReportDetailQuery() {
    return this.reportsRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.reported_user', 'reported_user')
      .leftJoinAndSelect('report.reported_post', 'reported_post')
      .leftJoinAndSelect('reported_post.user', 'reported_post_author')
      .leftJoinAndSelect('report.reported_message', 'reported_message')
      .leftJoinAndSelect('reported_message.user', 'reported_message_author')
      .leftJoinAndSelect('reported_message.shared_post', 'reported_message_post')
      .leftJoinAndSelect('report.resolved_by_user', 'resolved_by_user');
  }

  private async applyReportAction(report: Report, action: ReportAction) {
    if (action === ReportAction.NO_ACTION) {
      return;
    }

    if (action === ReportAction.REMOVE_POST) {
      if (!report.reported_post_id || !report.reported_post) {
        throw new BadRequestException('remove_post requires an available reported post');
      }

      await this.postRepository.delete(report.reported_post_id);

      if (report.reported_post.user_id) {
        await this.notificationService.notifySystemToUser(
          report.reported_post.user_id,
          'Bài viết của bạn đã bị gỡ',
          'Một bài viết của bạn đã bị gỡ vì vi phạm tiêu chuẩn cộng đồng.',
          {
            context: 'report_resolution',
            reportId: report.id,
            status: ReportStatus.RESOLVED,
            action,
            postId: report.reported_post_id,
          },
        );
      }
      return;
    }

    const reportedUserId = this.getReportedUserId(report);
    if (!reportedUserId) {
      throw new BadRequestException(`${action} requires a reported user`);
    }

    if (action === ReportAction.WARN_REPORTED) {
      await this.notificationService.notifySystemToUser(
        reportedUserId,
        'Cảnh báo vi phạm tiêu chuẩn cộng đồng',
        'Nội dung hoặc hành vi của bạn đã bị báo cáo và được xác nhận là vi phạm.',
        {
          context: 'report_resolution',
          reportId: report.id,
          status: ReportStatus.RESOLVED,
          action,
        },
      );
      return;
    }

    if (action === ReportAction.LOCK_USER) {
      const targetUser = await this.userRepository.findOneBy({ id: reportedUserId });
      if (!targetUser) {
        throw new NotFoundException('Reported user not found');
      }
      if (targetUser.role === RoleType.ADMIN) {
        throw new BadRequestException('Cannot lock an admin user');
      }

      await this.notificationService.notifySystemToUser(
        reportedUserId,
        'Tài khoản của bạn đã bị khóa',
        'Tài khoản của bạn đã bị khóa vì vi phạm tiêu chuẩn cộng đồng.',
        {
          context: 'report_resolution',
          reportId: report.id,
          status: ReportStatus.RESOLVED,
          action,
        },
      );

      targetUser.role = RoleType.BANNED;
      await this.userRepository.save(targetUser);
      await this.deviceSessionsService.revokeAllForUser(reportedUserId);
    }
  }

  private getReportedUserId(report: Report) {
    if (report.type === ReportType.USER) return report.reported_user_id;
    if (report.type === ReportType.POST) return report.reported_post?.user_id;
    if (report.type === ReportType.MESSAGE) return report.reported_message?.created_by;
    return null;
  }

  private async notifyReporter(
    report: Report,
    status: ReportStatus,
    action: ReportAction,
    adminNote: string,
  ) {
    const title =
      status === ReportStatus.REJECTED
        ? 'Báo cáo của bạn không được chấp nhận'
        : 'Báo cáo của bạn đã được xử lý';
    const message =
      status === ReportStatus.REJECTED
        ? `Chúng tôi đã xem xét báo cáo của bạn và chưa tìm thấy vi phạm. ${adminNote}`
        : `Cảm ơn bạn đã báo cáo. Chúng tôi đã xử lý nội dung vi phạm. ${adminNote}`;

    await this.notificationService.notifySystemToUser(
      report.reporter_id,
      title,
      message.trim(),
      {
        context: 'report_resolution',
        reportId: report.id,
        status,
        action,
      },
    );
  }
}
