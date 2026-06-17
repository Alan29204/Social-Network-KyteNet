import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useState } from 'react';

interface PostActionModalProps {
  post: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditClick: () => void;
}

export function PostActionModal({ post, open, onOpenChange, onEditClick }: PostActionModalProps) {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const isOwner = currentUser?.id === post?.user?.id;

  const [reportReason, setReportReason] = useState<string | null>(null);

  const deletePostMutation = useMutation({
    mutationFn: () => orvalClient({ url: `/posts/${post.id}`, method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
      queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      onOpenChange(false);
    },
  });

  const reportPostMutation = useMutation({
    mutationFn: (reason: string) => orvalClient({ 
      url: `/reports`, 
      method: 'POST',
      data: { type: 'post', reason, reported_post_id: post.id }
    }),
    onSuccess: () => {
      alert('Đã gửi báo cáo thành công!');
      setReportReason(null);
      onOpenChange(false);
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: () => orvalClient({ url: `/posts/${post.id}/remove-tag`, method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      onOpenChange(false);
    },
  });

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    alert('Đã sao chép liên kết!');
    onOpenChange(false);
  };

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
          <div className="p-4 font-bold text-center border-b border-border">Báo cáo bài viết</div>
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
              onClick={() => deletePostMutation.mutate()}
            >
              Xóa
            </button>
            <div className="h-[1px] w-full bg-border"></div>
            <button 
              className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80"
              onClick={() => { onOpenChange(false); onEditClick(); }}
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
