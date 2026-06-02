import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { ArrowLeft } from 'lucide-react';

interface EditPostModalProps {
  post: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPostModal({ post, open, onOpenChange }: EditPostModalProps) {
  const [content, setContent] = useState(post.content || post.caption || '');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'save' | 'cancel' | null>(null);
  const queryClient = useQueryClient();

  const updatePostMutation = useMutation({
    mutationFn: () => orvalClient({
      url: `/posts`,
      method: 'PATCH',
      data: { id: post.id, content, privacy: post.privacy || 'public' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['postDetail', post.id] });
      onOpenChange(false);
      setShowConfirm(false);
    }
  });

  const handleClose = () => {
    const originalContent = post.content || post.caption || '';
    if (content !== originalContent) {
      setConfirmAction('cancel');
      setShowConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleSave = () => {
    const originalContent = post.content || post.caption || '';
    if (content !== originalContent) {
      setConfirmAction('save');
      setShowConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirm = () => {
    if (confirmAction === 'save') {
      updatePostMutation.mutate();
    } else if (confirmAction === 'cancel') {
      setShowConfirm(false);
      setContent(post.content || post.caption || '');
      onOpenChange(false);
    }
  };

  if (showConfirm) {
    return (
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-xs p-0 gap-0 overflow-hidden rounded-xl border-none">
          <DialogTitle className="sr-only">Xác nhận</DialogTitle>
          <div className="p-4 text-center">
            <h3 className="font-bold text-lg mb-2">
              {confirmAction === 'save' ? 'Lưu thay đổi?' : 'Bỏ thay đổi?'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {confirmAction === 'save' 
                ? 'Bạn có chắc chắn muốn lưu nội dung mới của bài viết này?' 
                : 'Bạn có những thay đổi chưa lưu. Bạn có chắc chắn muốn thoát?'}
            </p>
          </div>
          <div className="h-[1px] w-full bg-border"></div>
          <button 
            className={`w-full p-4 text-sm font-bold hover:bg-muted transition-colors active:bg-muted/80 ${
              confirmAction === 'cancel' ? 'text-red-500' : 'text-blue-500'
            }`}
            onClick={handleConfirm}
          >
            {confirmAction === 'save' ? 'Lưu' : 'Thoát'}
          </button>
          <div className="h-[1px] w-full bg-border"></div>
          <button 
            className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80"
            onClick={() => setShowConfirm(false)}
          >
            Hủy
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-xl">
        <DialogTitle className="sr-only">Chỉnh sửa bài viết</DialogTitle>
        <div className="flex items-center justify-between border-b p-3">
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-bold">Chỉnh sửa bài viết</h2>
          <Button 
            variant="ghost" 
            className="text-blue-500 hover:text-blue-600 font-semibold"
            onClick={handleSave}
            disabled={content === (post.content || post.caption || '') || updatePostMutation.isPending}
          >
            Xong
          </Button>
        </div>
        
        <div className="p-4">
          <Textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] border-none resize-none focus-visible:ring-0 px-0 text-base"
            placeholder="Viết nội dung..."
          />
          
          {post.medias && post.medias.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 opacity-70 pointer-events-none">
              {post.medias.map((img: string, i: number) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border">
                  <img src={img} alt="media" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
