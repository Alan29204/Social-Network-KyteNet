import { useMemo, useState } from 'react';
import { CheckCircle, Eye, MessageSquare, ShieldAlert, User, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminDataTable } from '@/features/admin/components/admin-data-table';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import {
  useAdminReportDetail,
  useAdminReports,
  useResolveReport,
} from '@/features/admin/apis/admin-api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'rejected', label: 'Từ chối' },
];

const reasonLabels: Record<string, string> = {
  spam: 'Spam',
  violence: 'Bạo lực',
  adult_content: 'Nội dung người lớn',
  harassment: 'Quấy rối',
  fake_info: 'Thông tin giả',
  other: 'Khác',
};

const actionLabels: Record<string, string> = {
  no_action: 'Không áp dụng thêm',
  warn_reported: 'Cảnh báo người bị tố cáo',
  remove_post: 'Gỡ bài viết',
  lock_user: 'Khóa tài khoản',
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    resolved: 'bg-green-500/10 text-green-600 border-green-500/20',
    rejected: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  };
  const labels: Record<string, string> = {
    pending: 'Chờ xử lý',
    resolved: 'Đã xử lý',
    rejected: 'Từ chối',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${map[status] || map.pending}`}>
      {labels[status] || status}
    </span>
  );
};

const typeBadge = (type: string) => {
  const map: Record<string, string> = {
    post: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    user: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    message: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  };
  const labels: Record<string, string> = {
    post: 'Bài viết',
    user: 'Người dùng',
    message: 'Tin nhắn',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${map[type] || ''}`}>
      {labels[type] || type}
    </span>
  );
};

const unwrap = (value: any) => value?.data || value;

const getActionsForReport = (report: any, status: string) => {
  if (status === 'rejected') return ['no_action'];
  const actions = ['no_action', 'warn_reported', 'lock_user'];
  if (report?.type === 'post') actions.splice(2, 0, 'remove_post');
  return actions;
};

function UserLine({ user }: { user: any }) {
  if (!user) return <span className="text-muted-foreground">Không có dữ liệu</span>;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            {user.username?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{user.full_name || user.username || 'Người dùng'}</p>
        {user.username && <p className="text-xs text-muted-foreground truncate">@{user.username}</p>}
      </div>
    </div>
  );
}

function ReportTargetDetail({ report }: { report: any }) {
  if (report.type === 'post') {
    const post = report.reported_post;
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldAlert className="w-4 h-4" />
          Bài viết bị tố cáo
        </div>
        {!post ? (
          <p className="text-sm text-muted-foreground">Bài viết không còn khả dụng.</p>
        ) : (
          <>
            <UserLine user={post.user} />
            {post.content && <p className="text-sm whitespace-pre-wrap">{post.content}</p>}
            {post.medias?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {post.medias.map((url: string, index: number) => (
                  <div key={`${url}-${index}`} className="aspect-square rounded-md overflow-hidden bg-muted border border-border">
                    {/\.(mp4|webm|ogg)(\?|$)/i.test(url) ? (
                      <video src={url} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {post.created_at ? format(new Date(post.created_at), 'dd/MM/yyyy HH:mm', { locale: vi }) : ''}
            </p>
          </>
        )}
      </div>
    );
  }

  if (report.type === 'user') {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <User className="w-4 h-4" />
          Tài khoản bị tố cáo
        </div>
        <UserLine user={report.reported_user} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="w-4 h-4" />
        Tin nhắn bị tố cáo
      </div>
      {!report.reported_message ? (
        <p className="text-sm text-muted-foreground">Tin nhắn không còn khả dụng.</p>
      ) : (
        <>
          <UserLine user={report.reported_message.user} />
          <p className="text-sm whitespace-pre-wrap">
            {report.reported_message.message || 'Tin nhắn media/bài viết được chia sẻ'}
          </p>
          {report.reported_message.medias?.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {report.reported_message.medias.length} tệp media đính kèm
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminReportsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [detailReportId, setDetailReportId] = useState<string | null>(null);
  const [resolveDialog, setResolveDialog] = useState<any>(null);
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [adminAction, setAdminAction] = useState('warn_reported');
  const [adminNote, setAdminNote] = useState('');
  const { toast } = useToast();
  const limit = 15;

  const { data, isLoading } = useAdminReports({
    status: statusFilter || undefined,
    page,
    limit,
  });
  const { data: detailData, isLoading: isLoadingDetail } = useAdminReportDetail(detailReportId || undefined);
  const reports = unwrap(data)?.data || [];
  const meta = unwrap(data)?.meta || { page: 1, total_pages: 1 };
  const detailReport = unwrap(detailData);
  const resolveMutation = useResolveReport();

  const openResolveDialog = (report: any, status: 'resolved' | 'rejected') => {
    setResolveDialog(report);
    setResolveStatus(status);
    setAdminAction(status === 'rejected' ? 'no_action' : 'warn_reported');
    setAdminNote('');
  };

  const handleStatusChange = (value: string) => {
    setResolveStatus(value);
    if (value === 'rejected') {
      setAdminAction('no_action');
    } else if (adminAction === 'no_action') {
      setAdminAction('warn_reported');
    }
  };

  const handleResolve = () => {
    if (!resolveDialog || !adminNote.trim()) return;
    const actions = getActionsForReport(resolveDialog, resolveStatus);
    const nextAction = actions.includes(adminAction) ? adminAction : actions[0];

    resolveMutation.mutate(
      {
        id: resolveDialog.id,
        status: resolveStatus,
        admin_action: nextAction,
        admin_note: adminNote.trim(),
      },
      {
        onSuccess: () => {
          toast({ title: 'Thành công', description: 'Đã xử lý báo cáo' });
          setResolveDialog(null);
          setAdminNote('');
          setResolveStatus('resolved');
          setAdminAction('warn_reported');
        },
        onError: (error: any) => {
          toast({
            title: 'Lỗi',
            description: error?.response?.data?.message || 'Xử lý báo cáo thất bại',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const columns = useMemo(
    () => [
      {
        key: 'type',
        header: 'Loại',
        className: 'w-28',
        render: (report: any) => typeBadge(report.type),
      },
      {
        key: 'reason',
        header: 'Lý do',
        render: (report: any) => <span className="text-sm">{reasonLabels[report.reason] || report.reason}</span>,
      },
      {
        key: 'description',
        header: 'Mô tả',
        className: 'max-w-[220px]',
        render: (report: any) => (
          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{report.description || '—'}</p>
        ),
      },
      {
        key: 'reporter',
        header: 'Người báo cáo',
        render: (report: any) => <UserLine user={report.reporter} />,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        className: 'w-28',
        render: (report: any) => statusBadge(report.status),
      },
      {
        key: 'created_at',
        header: 'Ngày tạo',
        className: 'w-28',
        render: (report: any) => (
          <span className="text-muted-foreground text-xs">
            {report.created_at ? format(new Date(report.created_at), 'dd/MM/yyyy', { locale: vi }) : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'w-32',
        render: (report: any) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Xem chi tiết" onClick={() => setDetailReportId(report.id)}>
              <Eye className="w-4 h-4" />
            </Button>
            {report.status === 'pending' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-600 hover:bg-green-500/10"
                  title="Duyệt"
                  onClick={() => openResolveDialog(report, 'resolved')}
                >
                  <CheckCircle className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500 hover:text-gray-500 hover:bg-gray-500/10"
                  title="Từ chối"
                  onClick={() => openResolveDialog(report, 'rejected')}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const availableActions = getActionsForReport(resolveDialog, resolveStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý Báo cáo</h1>
        <p className="text-muted-foreground mt-1">Xử lý các báo cáo vi phạm từ cộng đồng</p>
      </div>

      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              statusFilter === tab.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AdminDataTable columns={columns} data={reports} isLoading={isLoading} emptyMessage="Không có báo cáo nào" />
      <AdminPagination page={meta.page || page} totalPages={meta.total_pages || 1} onPageChange={setPage} />

      <Dialog open={!!detailReportId} onOpenChange={(open) => !open && setDetailReportId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết báo cáo</DialogTitle>
          </DialogHeader>
          {isLoadingDetail ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : detailReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-sm font-medium">Người báo cáo</p>
                  <UserLine user={detailReport.reporter} />
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-sm font-medium">Thông tin báo cáo</p>
                  <div className="flex flex-wrap gap-2">{typeBadge(detailReport.type)} {statusBadge(detailReport.status)}</div>
                  <p className="text-sm">{reasonLabels[detailReport.reason] || detailReport.reason}</p>
                  {detailReport.description && <p className="text-sm text-muted-foreground">{detailReport.description}</p>}
                </div>
              </div>
              <ReportTargetDetail report={detailReport} />
              {detailReport.admin_note && (
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-sm font-medium">Kết quả xử lý</p>
                  <p className="text-sm">{actionLabels[detailReport.admin_action] || detailReport.admin_action}</p>
                  <p className="text-sm text-muted-foreground">{detailReport.admin_note}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Không tải được chi tiết báo cáo.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resolveDialog} onOpenChange={(open) => !open && setResolveDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Xử lý báo cáo</DialogTitle>
          </DialogHeader>
          {resolveDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  {typeBadge(resolveDialog.type)}
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs">{reasonLabels[resolveDialog.reason] || resolveDialog.reason}</span>
                </div>
                {resolveDialog.description && <p className="text-xs text-muted-foreground">{resolveDialog.description}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quyết định</Label>
                  <Select value={resolveStatus} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resolved">Duyệt vi phạm</SelectItem>
                      <SelectItem value="rejected">Từ chối báo cáo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Hành động</Label>
                  <Select value={adminAction} onValueChange={setAdminAction} disabled={resolveStatus === 'rejected'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableActions.map((action) => (
                        <SelectItem key={action} value={action}>
                          {actionLabels[action]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ghi chú xử lý <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Nhập ghi chú xử lý..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(null)}>
              Hủy
            </Button>
            <Button onClick={handleResolve} disabled={!adminNote.trim() || resolveMutation.isPending}>
              {resolveMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
