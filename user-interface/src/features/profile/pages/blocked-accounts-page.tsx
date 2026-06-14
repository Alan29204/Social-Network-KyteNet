import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Ban } from 'lucide-react';
import { orvalClient } from '@/services/apis/axios-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BlockUserDialog } from '../components/block-user-dialog';

interface BlockedUser {
  id: string;
  username: string;
  avatar?: string;
  full_name?: string;
}

/**
 * Trang "Tài khoản đã chặn" – liệt kê người dùng bị chặn và cho phép bỏ chặn.
 * Endpoint: GET /relations/blocked/list
 */
export function BlockedAccountsPage() {
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: async () => {
      const res: any = await orvalClient({
        url: '/relations/blocked/list',
        method: 'GET',
        params: { page: 1, limit: 50 },
      });
      // Hỗ trợ cả response bọc { data } lẫn mảng thuần
      return (res?.data?.data ?? res?.data ?? res ?? []) as BlockedUser[];
    },
  });

  const blockedUsers = Array.isArray(data) ? data : [];

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center gap-2 mb-1">
        <Ban className="w-5 h-5 text-destructive" />
        <h1 className="text-xl font-semibold">Tài khoản đã chặn</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Những người này không thể xem trang cá nhân, bài viết hoặc nhắn tin cho
        bạn.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          ))}
        </div>
      ) : blockedUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Ban className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-medium">Bạn chưa chặn ai</p>
          <p className="text-sm text-muted-foreground mt-1">
            Khi bạn chặn ai đó, họ sẽ xuất hiện ở đây.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {blockedUsers.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-3">
              <Link to={`/profile/${u.id}`}>
                <Avatar className="w-12 h-12">
                  <AvatarImage
                    src={u.avatar || '/default-avatar.png'}
                    className="object-cover"
                  />
                  <AvatarFallback>
                    {u.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/profile/${u.id}`}
                  className="font-medium hover:underline truncate block"
                >
                  {u.username}
                </Link>
                {u.full_name && (
                  <p className="text-sm text-muted-foreground truncate">
                    {u.full_name}
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedUser(u)}
              >
                Bỏ chặn
              </Button>
            </li>
          ))}
        </ul>
      )}

      {selectedUser && (
        <BlockUserDialog
          open={!!selectedUser}
          onOpenChange={(open) => !open && setSelectedUser(null)}
          user={{
            id: selectedUser.id,
            username: selectedUser.username,
            avatar: selectedUser.avatar,
          }}
          mode="unblock"
          onSuccess={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

export default BlockedAccountsPage;
