import { Users, FileText, UserPlus, AlertTriangle } from 'lucide-react';
import {
  useAdminPosts,
  useAdminStats,
  useAdminUsers,
} from '@/features/admin/apis/admin-api';
import { StatCard } from '@/features/admin/components/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const unwrap = (value: any) => value?.data || value;

export default function AdminDashboardPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, isLoading } = useAdminStats();
  const { data: newUsersData, isLoading: isLoadingUsers } = useAdminUsers({
    page: 1,
    limit: 5,
    created_from: sevenDaysAgo,
  });
  const { data: newPostsData, isLoading: isLoadingPosts } = useAdminPosts({
    page: 1,
    limit: 5,
    created_from: sevenDaysAgo,
  });

  const stats = unwrap(data);
  const newUsers = unwrap(newUsersData)?.data || [];
  const newPosts = unwrap(newPostsData)?.data || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Tổng quan hệ thống SNet</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard icon={Users} label="Tổng người dùng" value={stats?.total_users ?? 0} color="purple" />
          <StatCard icon={UserPlus} label="User mới 7 ngày" value={stats?.new_users_7d ?? 0} color="blue" />
          <StatCard icon={FileText} label="Tổng bài viết" value={stats?.total_posts ?? 0} color="green" />
          <StatCard icon={FileText} label="Bài viết 7 ngày" value={stats?.new_posts_7d ?? stats?.recent_posts_7d ?? 0} color="blue" />
          <StatCard icon={AlertTriangle} label="Báo cáo chờ xử lý" value={stats?.pending_reports ?? 0} color="amber" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Người dùng mới trong 7 ngày</h2>
          </div>
          <div className="divide-y divide-border">
            {isLoadingUsers ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))
            ) : newUsers.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Chưa có người dùng mới.</p>
            ) : (
              newUsers.map((user: any) => (
                <div key={user.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          {user.username?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name || user.username}</p>
                      <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {user.created_at ? format(new Date(user.created_at), 'dd/MM', { locale: vi }) : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Bài viết mới trong 7 ngày</h2>
          </div>
          <div className="divide-y divide-border">
            {isLoadingPosts ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))
            ) : newPosts.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Chưa có bài viết mới.</p>
            ) : (
              newPosts.map((post: any) => (
                <div key={post.id} className="p-4 space-y-1">
                  <p className="text-sm line-clamp-2">
                    {post.content || <span className="text-muted-foreground italic">Bài viết media/hashtag</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{post.user?.username || 'unknown'} ·{' '}
                    {post.created_at ? format(new Date(post.created_at), 'dd/MM HH:mm', { locale: vi }) : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
