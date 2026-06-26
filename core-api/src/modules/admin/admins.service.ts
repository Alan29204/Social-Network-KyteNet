import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { IAdmin } from './admin.interface';
import { AddAdminDto } from './dto/add-admin.dto';
import { RoleType } from 'src/common/enums/role.enum';
import { ReportsService } from '../reports/reports.service';
import { ReportAction, ReportStatus } from '../reports/entities/report.entity';
import { NotificationService } from '../notifications/notifications.service';

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly reportsService: ReportsService,
    private readonly notificationService: NotificationService,
  ) {}

  /** Promote a user to admin role */
  async addAdmin(admin: IAdmin, dto: AddAdminDto) {
    try {
      const user = await this.userRepository.findOneBy({ id: dto.user_id });
      if (user && user.role === RoleType.USER) {
        user.role = RoleType.ADMIN;
        const updatedUser = await this.userRepository.save(user);
        return {
          message: 'Admin added successfully',
          user: this.toAdminUser(updatedUser),
        };
      }
      throw new BadRequestException('User not found or role is not user');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException();
    }
  }

  /** List all users with pagination and optional search/role filter */
  async listUsers(
    page = 1,
    limit = 20,
    search?: string,
    createdFrom?: string,
    role?: RoleType,
  ) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (page - 1) * limit;
    const query = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.username',
        'user.full_name',
        'user.avatar',
        'user.role',
        'user.privacy',
        'user.created_at',
      ])
      .orderBy('user.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      query.andWhere(
        '(user.username ILIKE :q OR user.email ILIKE :q OR user.full_name ILIKE :q)',
        {
        q: `%${search}%`,
        },
      );
    }

    if (createdFrom) {
      const fromDate = new Date(createdFrom);
      if (!Number.isNaN(fromDate.getTime())) {
        query.andWhere('user.created_at >= :createdFrom', {
          createdFrom: fromDate,
        });
      }
    }

    if (role && Object.values(RoleType).includes(role)) {
      query.andWhere('user.role = :role', { role });
    }

    const [users, total] = await query.getManyAndCount();
    return {
      data: users,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /** Ban or unban a user by setting/clearing their role */
  async banUser(admin: IAdmin, userId: string, ban: boolean) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    if (admin?.id === userId && ban) {
      throw new BadRequestException('Cannot ban your own account');
    }
    if (user.role === RoleType.ADMIN) {
      throw new BadRequestException('Cannot ban an admin user');
    }

    user.role = ban ? RoleType.BANNED : RoleType.USER;
    const updatedUser = await this.userRepository.save(user);

    if (ban) {
      await this.notificationService.notifySystemToUser(
        userId,
        'Tài khoản của bạn đã bị khóa',
        'Tài khoản của bạn đã bị khóa bởi quản trị viên vì vi phạm tiêu chuẩn cộng đồng.',
        { context: 'admin_account_lock' },
      );
    }

    return {
      message: ban ? 'User banned successfully' : 'User unbanned successfully',
      user: this.toAdminUser(updatedUser),
    };
  }

  /** Delete a user account */
  async deleteUser(userId: string) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === RoleType.ADMIN) {
      throw new BadRequestException('Cannot delete an admin user');
    }
    await this.userRepository.delete(userId);
    return { message: 'User deleted successfully' };
  }

  /** List all posts with pagination */
  async listPosts(page = 1, limit = 20, search?: string, createdFrom?: string) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (page - 1) * limit;
    const query = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .orderBy('post.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      query.andWhere(
        '(post.content ILIKE :q OR user.username ILIKE :q OR user.full_name ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    if (createdFrom) {
      const fromDate = new Date(createdFrom);
      if (!Number.isNaN(fromDate.getTime())) {
        query.andWhere('post.created_at >= :createdFrom', {
          createdFrom: fromDate,
        });
      }
    }

    const [posts, total] = await query.getManyAndCount();
    return {
      data: posts,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /** Force-delete a post as admin */
  async deletePost(postId: string) {
    const post = await this.postRepository.findOneBy({ id: postId });
    if (!post) throw new NotFoundException('Post not found');
    await this.postRepository.delete(postId);
    return { message: 'Post deleted by admin' };
  }

  /** Get system stats */
  async getStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      totalUsers,
      totalPosts,
      pendingReports,
      newUsers,
      newPosts,
    ] = await Promise.all([
      this.userRepository.count(),
      this.postRepository.count(),
      this.reportsService.listReports(ReportStatus.PENDING, 1, 1),
      this.userRepository
        .createQueryBuilder('user')
        .where('user.created_at >= :since', { since: sevenDaysAgo })
        .getCount(),
      this.postRepository
        .createQueryBuilder('post')
        .where('post.created_at >= :since', { since: sevenDaysAgo })
        .getCount(),
    ]);

    return {
      total_users: totalUsers,
      total_posts: totalPosts,
      new_users_7d: newUsers,
      new_posts_7d: newPosts,
      recent_posts_7d: newPosts,
      pending_reports: pendingReports.meta.total,
    };
  }

  /** Proxy to reports service — list reports */
  async listReports(status?: ReportStatus, page = 1, limit = 20) {
    return this.reportsService.listReports(status, page, limit);
  }

  async getReportDetail(id: string) {
    return this.reportsService.getReportDetail(id);
  }

  /** Proxy to reports service — resolve/reject a report */
  async resolveReport(
    id: string,
    admin: IAdmin,
    admin_note: string,
    status: ReportStatus,
    admin_action: ReportAction,
  ) {
    return this.reportsService.resolveReport(
      id,
      admin.id,
      admin_note,
      status,
      admin_action,
    );
  }

  private toAdminUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      avatar: user.avatar,
      role: user.role,
      privacy: user.privacy,
      created_at: user.created_at,
    };
  }
}
