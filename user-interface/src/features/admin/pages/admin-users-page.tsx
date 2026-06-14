import { useState, useMemo } from 'react';
import { Search, MoreHorizontal, ShieldCheck, Ban, Trash2, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdminDataTable } from '@/features/admin/components/admin-data-table';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import {
  useAdminUsers,
  useBanUser,
  useUnbanUser,
  useDeleteUser,
  useAddAdmin,
} from '@/features/admin/apis/admin-api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const roleBadge = (role: string) => {
  const map: Record<string, string> = {
    admin: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    user: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    banned: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  const labels: Record<string, string> = {
    admin: 'Admin',
    user: 'User',
    banned: 'Banned',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${map[role] || map.user}`}>
      {labels[role] || role}
    </span>
  );
};

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogState, setDialogState] = useState<{
    type: 'ban' | 'unban' | 'delete' | 'promote' | null;
    user: any;
  }>({ type: null, user: null });

  const { toast } = useToast();
  const limit = 15;

  const { data, isLoading } = useAdminUsers({ page, limit, search: search || undefined });
  const users = data?.data?.data || data?.data || [];
  const meta = data?.data?.meta || data?.meta || { page: 1, total_pages: 1 };

  const banMutation = useBanUser();
  const unbanMutation = useUnbanUser();
  const deleteMutation = useDeleteUser();
  const promoteMutation = useAddAdmin();

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    const timeout = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 500);
    return () => clearTimeout(timeout);
  };

  const handleAction = () => {
    const { type, user } = dialogState;
    if (!type || !user) return;

    const mutation = {
      ban: banMutation,
      unban: unbanMutation,
      delete: deleteMutation,
      promote: promoteMutation,
    }[type];

    mutation.mutate(user.id, {
      onSuccess: () => {
        const messages: Record<string, string> = {
          ban: `Đã khóa tài khoản ${user.username}`,
          unban: `Đã mở khóa tài khoản ${user.username}`,
          delete: `Đã xóa tài khoản ${user.username}`,
          promote: `Đã cấp quyền Admin cho ${user.username}`,
        };
        toast({ title: 'Thành công', description: messages[type] });
        setDialogState({ type: null, user: null });
      },
      onError: () => {
        toast({ title: 'Lỗi', description: 'Thao tác thất bại', variant: 'destructive' });
      },
    });
  };

  const columns = useMemo(
    () => [
      {
        key: 'avatar',
        header: '',
        className: 'w-12',
        render: (user: any) => (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                {user.username?.charAt(0)?.toUpperCase()}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'username',
        header: 'Username',
        render: (user: any) => <span className="font-medium">{user.username}</span>,
      },
      {
        key: 'email',
        header: 'Email',
        render: (user: any) => <span className="text-muted-foreground">{user.email}</span>,
      },
      {
        key: 'role',
        header: 'Role',
        render: (user: any) => roleBadge(user.role),
      },
      {
        key: 'created_at',
        header: 'Ngày tạo',
        render: (user: any) => (
          <span className="text-muted-foreground text-xs">
            {user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy', { locale: vi }) : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'w-12',
        render: (user: any) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user.role !== 'admin' && (
                <>
                  {user.role === 'banned' ? (
                    <DropdownMenuItem onClick={() => setDialogState({ type: 'unban', user })}>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Mở khóa
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setDialogState({ type: 'ban', user })}>
                      <Ban className="w-4 h-4 mr-2" />
                      Khóa tài khoản
                    </DropdownMenuItem>
                  )}
                  {user.role === 'user' && (
                    <DropdownMenuItem onClick={() => setDialogState({ type: 'promote', user })}>
                      <ShieldAlert className="w-4 h-4 mr-2" />
                      Cấp quyền Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDialogState({ type: 'delete', user })}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa tài khoản
                  </DropdownMenuItem>
                </>
              )}
              {user.role === 'admin' && (
                <DropdownMenuItem disabled>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Không thể thao tác Admin
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  const dialogMessages: Record<string, { title: string; desc: string }> = {
    ban: {
      title: 'Khóa tài khoản',
      desc: `Bạn có chắc muốn khóa tài khoản "${dialogState.user?.username}"? Người dùng sẽ không thể đăng nhập.`,
    },
    unban: {
      title: 'Mở khóa tài khoản',
      desc: `Mở khóa tài khoản "${dialogState.user?.username}"? Người dùng sẽ có thể đăng nhập lại.`,
    },
    delete: {
      title: 'Xóa tài khoản',
      desc: `Xóa vĩnh viễn tài khoản "${dialogState.user?.username}"? Hành động này không thể hoàn tác.`,
    },
    promote: {
      title: 'Cấp quyền Admin',
      desc: `Cấp quyền Admin cho "${dialogState.user?.username}"? Người dùng sẽ có toàn quyền quản trị.`,
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Người dùng</h1>
          <p className="text-muted-foreground mt-1">Xem, tìm kiếm và quản lý tài khoản người dùng</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo username hoặc email..."
          className="pl-9"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <AdminDataTable columns={columns} data={users} isLoading={isLoading} emptyMessage="Không tìm thấy người dùng" />

      {/* Pagination */}
      <AdminPagination page={meta.page || page} totalPages={meta.total_pages || 1} onPageChange={setPage} />

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!dialogState.type}
        onOpenChange={(open) => !open && setDialogState({ type: null, user: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogState.type && dialogMessages[dialogState.type]?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState.type && dialogMessages[dialogState.type]?.desc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={dialogState.type === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
