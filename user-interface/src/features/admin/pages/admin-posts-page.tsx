import { useState, useMemo } from 'react';
import { Trash2, Eye, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminDataTable } from '@/features/admin/components/admin-data-table';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { useAdminPosts, useDeletePost } from '@/features/admin/apis/admin-api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function AdminPostsPage() {
  const [page, setPage] = useState(1);
  const [deletePost, setDeletePost] = useState<any>(null);
  const [viewPost, setViewPost] = useState<any>(null);
  const { toast } = useToast();
  const limit = 15;

  const { data, isLoading } = useAdminPosts({ page, limit });
  const posts = data?.data?.data || data?.data || [];
  const meta = data?.data?.meta || data?.meta || { page: 1, total_pages: 1 };

  const deleteMutation = useDeletePost();

  const handleDelete = () => {
    if (!deletePost) return;
    deleteMutation.mutate(deletePost.id, {
      onSuccess: () => {
        toast({ title: 'Thành công', description: 'Đã xóa bài viết' });
        setDeletePost(null);
      },
      onError: () => {
        toast({ title: 'Lỗi', description: 'Xóa bài viết thất bại', variant: 'destructive' });
      },
    });
  };

  const columns = useMemo(
    () => [
      {
        key: 'content',
        header: 'Nội dung',
        className: 'max-w-[300px]',
        render: (post: any) => (
          <button
            className="text-left hover:text-primary transition-colors cursor-pointer"
            onClick={() => setViewPost(post)}
          >
            <p className="truncate max-w-[280px]">
              {post.content || <span className="text-muted-foreground italic">Không có nội dung</span>}
            </p>
          </button>
        ),
      },
      {
        key: 'user',
        header: 'Tác giả',
        render: (post: any) => (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted overflow-hidden shrink-0">
              {post.user?.avatar ? (
                <img src={post.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 flex items-center justify-center text-xs text-muted-foreground">
                  {post.user?.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <span className="text-sm">{post.user?.username || '—'}</span>
          </div>
        ),
      },
      {
        key: 'medias',
        header: 'Media',
        className: 'w-20',
        render: (post: any) => {
          const count = post.medias?.length || 0;
          return count > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="w-3.5 h-3.5" />
              {count}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      {
        key: 'privacy',
        header: 'Quyền riêng tư',
        className: 'w-28',
        render: (post: any) => {
          const labels: Record<string, string> = { public: 'Công khai', private: 'Riêng tư', follower: 'Follower' };
          return <span className="text-xs text-muted-foreground">{labels[post.privacy] || post.privacy}</span>;
        },
      },
      {
        key: 'created_at',
        header: 'Ngày tạo',
        className: 'w-28',
        render: (post: any) => (
          <span className="text-muted-foreground text-xs">
            {post.created_at ? format(new Date(post.created_at), 'dd/MM/yyyy', { locale: vi }) : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'w-20',
        render: (post: any) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setViewPost(post)}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => setDeletePost(post)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý Bài viết</h1>
        <p className="text-muted-foreground mt-1">Xem và gỡ bỏ bài viết vi phạm</p>
      </div>

      {/* Table */}
      <AdminDataTable columns={columns} data={posts} isLoading={isLoading} emptyMessage="Không có bài viết nào" />

      {/* Pagination */}
      <AdminPagination page={meta.page || page} totalPages={meta.total_pages || 1} onPageChange={setPage} />

      {/* Delete Dialog */}
      <AlertDialog open={!!deletePost} onOpenChange={(open) => !open && setDeletePost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bài viết</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa bài viết này? Hành động không thể hoàn tác.
              {deletePost?.content && (
                <span className="block mt-2 p-2 rounded bg-muted text-xs truncate">
                  "{deletePost.content.slice(0, 100)}..."
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Post Dialog */}
      <Dialog open={!!viewPost} onOpenChange={(open) => !open && setViewPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết bài viết</DialogTitle>
          </DialogHeader>
          {viewPost && (
            <div className="space-y-4">
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                  {viewPost.user?.avatar ? (
                    <img src={viewPost.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center text-sm text-muted-foreground">
                      {viewPost.user?.username?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{viewPost.user?.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {viewPost.created_at && format(new Date(viewPost.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </p>
                </div>
              </div>

              {/* Content */}
              {viewPost.content && (
                <p className="text-sm whitespace-pre-wrap">{viewPost.content}</p>
              )}

              {/* Medias */}
              {viewPost.medias?.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {viewPost.medias.map((url: string, i: number) => (
                    <div key={i} className="rounded-lg overflow-hidden border border-border bg-muted aspect-square">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* Hashtags */}
              {viewPost.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {viewPost.hashtags.map((tag: string, i: number) => (
                    <span key={i} className="text-xs text-primary">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
