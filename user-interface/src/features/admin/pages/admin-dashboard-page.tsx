import { Users, FileText, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAdminStats } from '@/features/admin/apis/admin-api';
import { StatCard } from '@/features/admin/components/stat-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboardPage() {
  const { data, isLoading } = useAdminStats();
  const stats = data?.data || data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Tổng quan hệ thống SNet</p>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Tổng người dùng"
            value={stats?.total_users ?? 0}
            color="purple"
          />
          <StatCard
            icon={FileText}
            label="Tổng bài viết"
            value={stats?.total_posts ?? 0}
            color="blue"
          />
          <StatCard
            icon={TrendingUp}
            label="Bài viết 7 ngày qua"
            value={stats?.recent_posts_7d ?? 0}
            color="green"
          />
          <StatCard
            icon={AlertTriangle}
            label="Báo cáo chờ xử lý"
            value={stats?.pending_reports ?? 0}
            color="amber"
          />
        </div>
      )}

      {/* Quick Info */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Hướng dẫn nhanh</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-medium text-sm">Quản lý người dùng</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tìm kiếm, khóa/mở khóa tài khoản, hoặc cấp quyền Admin cho người dùng.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="font-medium text-sm">Quản lý bài viết</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Xem và gỡ bỏ các bài viết vi phạm chính sách cộng đồng.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <h3 className="font-medium text-sm">Xử lý báo cáo</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Duyệt và xử lý các báo cáo vi phạm từ cộng đồng người dùng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
