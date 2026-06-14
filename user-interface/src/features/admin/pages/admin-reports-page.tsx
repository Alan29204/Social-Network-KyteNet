import { useState, useMemo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
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
import { AdminDataTable } from '@/features/admin/components/admin-data-table';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { useAdminReports, useResolveReport } from '@/features/admin/apis/admin-api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'rejected', label: 'Từ chối' },
];

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

const reasonLabels: Record<string, string> = {
  spam: 'Spam',
  violence: 'Bạo lực',
  adult_content: 'Nội dung người lớn',
  harassment: 'Quấy rối',
  fake_info: 'Thông tin giả',
  other: 'Khác',
};

export default function AdminReportsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [resolveDialog, setResolveDialog] = useState<any>(null);
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [adminNote, setAdminNote] = useState('');
  const { toast } = useToast();
  const limit = 15;

  const { data, isLoading } = useAdminReports({
    status: statusFilter || undefined,
    page,
    limit,
  });
  const reports = data?.data?.data || data?.data || [];
  const meta = data?.data?.meta || data?.meta || { page: 1, total_pages: 1 };

  const resolveMutation = useResolveReport();

  const handleResolve = () => {
    if (!resolveDialog || !adminNote.trim()) return;
    resolveMutation.mutate(
      { id: resolveDialog.id, status: resolveStatus, admin_note: adminNote },
      {
        onSuccess: () => {
          toast({ title: 'Thành công', description: 'Đã xử lý báo cáo' });
          setResolveDialog(null);
          setAdminNote('');
          setResolveStatus('resolved');
        },
        onError: () => {
          toast({ title: 'Lỗi', description: 'Xử lý báo cáo thất bại', variant: 'destructive' });
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
        render: (report: any) => (
          <span className="text-sm">{reasonLabels[report.reason] || report.reason}</span>
        ),
      },
      {
        key: 'description',
        header: 'Mô tả',
        className: 'max-w-[200px]',
        render: (report: any) => (
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
            {report.description || '—'}
          </p>
        ),
      },
      {
        key: 'reporter',
        header: 'Người báo cáo',
        render: (report: any) => (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted overflow-hidden shrink-0">
              {report.reporter?.avatar ? (
                <img src={report.reporter.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 flex items-center justify-center text-xs text-muted-foreground">
                  {report.reporter?.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <span className="text-xs">{report.reporter?.username || '—'}</span>
          </div>
        ),
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
        className: 'w-24',
        render: (report: any) =>
          report.status === 'pending' ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-green-600 hover:text-green-600 hover:bg-green-500/10"
                title="Duyệt"
                onClick={() => {
                  setResolveDialog(report);
                  setResolveStatus('resolved');
                  setAdminNote('');
                }}
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-500 hover:bg-gray-500/10"
                title="Từ chối"
                onClick={() => {
                  setResolveDialog(report);
                  setResolveStatus('rejected');
                  setAdminNote('');
                }}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý Báo cáo</h1>
        <p className="text-muted-foreground mt-1">Xử lý các báo cáo vi phạm từ cộng đồng</p>
      </div>

      {/* Status Tabs */}
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

      {/* Table */}
      <AdminDataTable columns={columns} data={reports} isLoading={isLoading} emptyMessage="Không có báo cáo nào" />

      {/* Pagination */}
      <AdminPagination page={meta.page || page} totalPages={meta.total_pages || 1} onPageChange={setPage} />

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={(open) => !open && setResolveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xử lý báo cáo</DialogTitle>
          </DialogHeader>
          {resolveDialog && (
            <div className="space-y-4">
              {/* Report info */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-2">
                  {typeBadge(resolveDialog.type)}
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs">{reasonLabels[resolveDialog.reason] || resolveDialog.reason}</span>
                </div>
                {resolveDialog.description && (
                  <p className="text-xs text-muted-foreground">{resolveDialog.description}</p>
                )}
              </div>

              {/* Status select */}
              <div className="space-y-2">
                <Label>Quyết định</Label>
                <Select value={resolveStatus} onValueChange={setResolveStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved">✅ Duyệt (Vi phạm)</SelectItem>
                    <SelectItem value="rejected">❌ Từ chối (Không vi phạm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Admin note */}
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
            <Button
              onClick={handleResolve}
              disabled={!adminNote.trim() || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
