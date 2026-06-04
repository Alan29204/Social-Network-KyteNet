import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminsService } from './admins.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { Admin } from 'src/common/decorators/customize';
import { IAdmin } from './admin.interface';
import { AddAdminDto } from './dto/add-admin.dto';
import { ReportStatus } from '../reports/entities/report.entity';
import { ResolveReportDto } from './dto/resolve-report.dto';

@Controller('admins')
@ApiTags('Admins')
@UseGuards(AdminGuard)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  // ── Admin Management ──────────────────────────────────
  @Post('add-admin')
  @ApiOperation({ summary: 'Admin: Promote user to admin' })
  addAdmin(@Admin() admin: IAdmin, @Body() dto: AddAdminDto) {
    return this.adminsService.addAdmin(admin, dto);
  }

  // ── Stats ─────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Admin: Get system statistics' })
  getStats() {
    return this.adminsService.getStats();
  }

  // ── User Management ───────────────────────────────────
  @Get('users')
  @ApiOperation({ summary: 'Admin: List all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminsService.listUsers(page || 1, limit || 20, search);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Admin: Ban a user' })
  banUser(@Param('id') id: string) {
    return this.adminsService.banUser(id, true);
  }

  @Patch('users/:id/unban')
  @ApiOperation({ summary: 'Admin: Unban a user' })
  unbanUser(@Param('id') id: string) {
    return this.adminsService.banUser(id, false);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Admin: Delete a user' })
  deleteUser(@Param('id') id: string) {
    return this.adminsService.deleteUser(id);
  }

  // ── Post Management ───────────────────────────────────
  @Get('posts')
  @ApiOperation({ summary: 'Admin: List all posts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listPosts(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminsService.listPosts(page || 1, limit || 20);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Admin: Force-delete a post' })
  deletePost(@Param('id') id: string) {
    return this.adminsService.deletePost(id);
  }

  // ── Report Management ─────────────────────────────────
  @Get('reports')
  @ApiOperation({ summary: 'Admin: List all reports' })
  @ApiQuery({ name: 'status', required: false, enum: ReportStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listReports(
    @Query('status') status?: ReportStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminsService.listReports(status, page || 1, limit || 20);
  }

  @Patch('reports/:id/resolve')
  @ApiOperation({ summary: 'Admin: Resolve or reject a report' })
  resolveReport(@Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.adminsService.resolveReport(id, dto.admin_note, dto.status);
  }
}
