import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  getApiErrorMessage,
  getMutationPostId,
  getPostAuthorId,
  invalidatePostSurfaces,
  removePostFromLists,
  restorePostSurfaces,
  snapshotPostSurfaces,
} from '@/features/posts/utils/post-cache';

interface PostActionModalProps {
  post: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditClick: () => void;
  onDeleted?: (postId: string) => void;
}

export function PostActionModal({
  post,
  open,
  onOpenChange,
  onEditClick,
  onDeleted,
}: PostActionModalProps) {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUser?.id === (post?.user?.id || post?.user_id);

  const [reportReason, setReportReason] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) {
      setReportReason(null);
      setShowDeleteConfirm(false);
      setErrorMessage('');
    }
  }, [open]);

  const deletePostMutation = useMutation<
    any,
    any,
    void,
    { snapshots: ReturnType<typeof snapshotPostSurfaces> }
  >({
    mutationFn: () =>
      orvalClient({ url: `/posts/${post.id}`, method: 'DELETE' }),
    onMutate: () => {
      setErrorMessage('');
      const snapshots = snapshotPostSurfaces(queryClient);
      removePostFromLists(queryClient, post.id);
      return { snapshots };
    },
    onSuccess: async (response: any) => {
      const deletedPostId = getMutationPostId(response, post.id);
      removePostFromLists(queryClient, deletedPostId);
      await invalidatePostSurfaces(queryClient, {
        userId: getPostAuthorId(post),
        postId: deletedPostId,
        includeSearch: true,
      });
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onDeleted?.(deletedPostId);
      toast({ title: 'Đã xóa bài viết' });
    },
    onError: (error: any, _variables, context) => {
      if (context?.snapshots) {
        restorePostSurfaces(queryClient, context.snapshots);
      }
      setErrorMessage(
        getApiErrorMessage(error, 'Không thể xóa bài viết. Vui lòng thử lại.'),
      );
    },
  });

  const reportPostMutation = useMutation({
    mutationFn: (reason: string) =>
      orvalClient({
        url: `/reports`,
        method: 'POST',
        data: { type: 'post', reason, reported_post_id: post.id },
      }),
    onSuccess: () => {
      toast({
        title: 'Đã gửi báo cáo',
      });
      setReportReason(null);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Không thể gửi báo cáo',
        description: 'Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: () =>
      orvalClient({ url: `/posts/${post.id}/remove-tag`, method: 'POST' }),
    onSuccess: async () => {
      await invalidatePostSurfaces(queryClient, {
        userId: getPostAuthorId(post),
        postId: post.id,
        includeSearch: true,
      });
      onOpenChange(false);
    },
  });

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast({ title: 'Đã sao chép liên kết' });
    onOpenChange(false);
  };

  if (showDeleteConfirm) {
    return (
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (deletePostMutation.isPending) return;
          if (!nextOpen) setShowDeleteConfirm(false);
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-xs p-0 gap-0 overflow-hidden rounded-xl border-none">
          <DialogTitle className="sr-only">Xác nhận xóa bài viết</DialogTitle>
          <div className="p-4 text-center">
            <h3 className="font-bold text-lg mb-2">Xóa bài viết?</h3>
            <p className="text-sm text-muted-foreground">
              Bài viết sẽ bị xóa khỏi trang cá nhân, bảng tin và kết quả tìm
              kiếm.
            </p>
            {errorMessage && (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
          </div>
          <div className="h-[1px] w-full bg-border"></div>
          <button
            className="w-full p-4 text-sm font-bold text-red-500 hover:bg-muted transition-colors active:bg-muted/80 disabled:opacity-60"
            onClick={() => deletePostMutation.mutate()}
            disabled={deletePostMutation.isPending}
          >
            {deletePostMutation.isPending ? 'Đang xóa...' : 'Xóa'}
          </button>
          <div className="h-[1px] w-full bg-border"></div>
          <button
            className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80 disabled:opacity-60"
            onClick={() => {
              setShowDeleteConfirm(false);
              setErrorMessage('');
            }}
            disabled={deletePostMutation.isPending}
          >
            Quay lại
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  if (reportReason !== null) {
    // Show report reasons
    const reasons = [
      { id: 'spam', label: 'Spam' },
      { id: 'violence', label: 'Bạo lực' },
      { id: 'adult_content', label: 'Nội dung người lớn' },
      { id: 'harassment', label: 'Quấy rối' },
      { id: 'fake_info', label: 'Thông tin sai lệch' },
      { id: 'other', label: 'Khác' },
    ];

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xs p-0 gap-0 overflow-hidden rounded-xl border-none">
          <DialogTitle className="sr-only">Báo cáo bài viết</DialogTitle>
          <div className="p-4 font-bold text-center border-b border-border">
            Báo cáo bài viết
          </div>
          {reasons.map((r) => (
            <button
              key={r.id}
              className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80 border-b border-border text-left px-6"
              onClick={() => reportPostMutation.mutate(r.id)}
            >
              {r.label}
            </button>
          ))}
          <button
            className="w-full p-4 text-sm font-semibold hover:bg-muted transition-colors active:bg-muted/80"
            onClick={() => setReportReason(null)}
          >
            Quay lại
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs p-0 gap-0 overflow-hidden rounded-xl border-none">
        <DialogTitle className="sr-only">Tùy chọn bài viết</DialogTitle>
        {isOwner ? (
          <>
            <button
              className="w-full p-4 text-sm font-bold text-red-500 hover:bg-muted transition-colors active:bg-muted/80"
              onClick={() => {
                setErrorMessage('');
                setShowDeleteConfirm(true);
              }}
            >
              Xóa
            </button>
            <div className="h-[1px] w-full bg-border"></div>
            <button
              className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80"
              onClick={() => {
                onOpenChange(false);
                onEditClick();
              }}
            >
              Chỉnh sửa
            </button>
            <div className="h-[1px] w-full bg-border"></div>
            <button
              className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80"
              onClick={copyLink}
            >
              Sao chép liên kết
            </button>
          </>
        ) : (
          <button
            className="w-full p-4 text-sm font-bold text-red-500 hover:bg-muted transition-colors active:bg-muted/80"
            onClick={() => setReportReason('pending')}
          >
            Báo cáo
          </button>
        )}
        {post?.tagged_users?.includes(currentUser?.id) && (
          <>
            <div className="h-[1px] w-full bg-border"></div>
            <button
              className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80"
              onClick={() => removeTagMutation.mutate()}
            >
              Gỡ thẻ
            </button>
          </>
        )}
        <div className="h-[1px] w-full bg-border"></div>
        <button
          className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80"
          onClick={() => onOpenChange(false)}
        >
          Hủy
        </button>
      </DialogContent>
    </Dialog>
  );
}
