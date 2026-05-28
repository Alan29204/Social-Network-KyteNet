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
import { ReportStatus } from '../reports/entities/report.entity';

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly reportsService: ReportsService,
  ) {}

  /** Promote a user to admin role */
  async addAdmin(admin: IAdmin, dto: AddAdminDto) {
    try {
      const user = await this.userRepository.findOneBy({ id: dto.user_id });
      if (user && user.role === RoleType.USER) {
        user.role = RoleType.ADMIN;
        await this.userRepository.save(user);
        return { message: 'Admin added successfully' };
      }
      throw new BadRequestException('User not found or role is not user');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException();
    }
  }

  /** List all users with pagination and optional search */
  async listUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const query = this.userRepository.createQueryBuilder('user')
      .select([
        'user.id', 'user.email', 'user.username', 'user.avatar',
        'user.role', 'user.privacy', 'user.created_at',
      ])
      .orderBy('user.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      query.where('user.username ILIKE :q OR user.email ILIKE :q', { q: `%${search}%` });
    }

    const [users, total] = await query.getManyAndCount();
    return { data: users, meta: { page, limit, total, total_pages: Math.ceil(total / limit) } };
  }

  /** Ban or unban a user by setting/clearing their role */
  async banUser(userId: string, ban: boolean) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === RoleType.ADMIN) {
      throw new BadRequestException('Cannot ban an admin user');
    }

    await this.userRepository.update(userId, {
      role: ban ? ('banned' as any) : RoleType.USER,
    });
    return { message: ban ? 'User banned successfully' : 'User unbanned successfully' };
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
  async listPosts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [posts, total] = await this.postRepository.findAndCount({
      relations: ['user'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });
    return { data: posts, meta: { page, limit, total, total_pages: Math.ceil(total / limit) } };
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
    const [totalUsers, totalPosts, pendingReports] = await Promise.all([
      this.userRepository.count(),
      this.postRepository.count(),
      this.reportsService.listReports(ReportStatus.PENDING, 1, 1),
    ]);

    // Posts created in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPosts = await this.postRepository
      .createQueryBuilder('post')
      .where('post.created_at > :since', { since: sevenDaysAgo })
      .getCount();

    return {
      total_users: totalUsers,
      total_posts: totalPosts,
      recent_posts_7d: recentPosts,
      pending_reports: pendingReports.meta.total,
    };
  }

  /** Proxy to reports service — list reports */
  async listReports(status?: ReportStatus, page = 1, limit = 20) {
    return this.reportsService.listReports(status, page, limit);
  }

  /** Proxy to reports service — resolve/reject a report */
  async resolveReport(id: string, admin_note: string, status: ReportStatus) {
    return this.reportsService.resolveReport(id, admin_note, status);
  }
}
