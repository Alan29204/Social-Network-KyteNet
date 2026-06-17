import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { MentionsInput, Mention, SuggestionDataItem } from 'react-mentions';
import { searchControllerSearchUsers } from '@/services/apis/gen/queries';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
    mutationFn: (taggedUserIds: string[]) => orvalClient({
      url: `/posts`,
      method: 'PATCH',
      data: { id: post.id, content, privacy: post.privacy || 'public', tagged_users: taggedUserIds }
    }),
    onSuccess: async () => {
      // Đợi tải lại dữ liệu ngầm xong
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['infinite'] }),
        queryClient.invalidateQueries({ queryKey: ['postDetail'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] })
      ]);

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
      const taggedUserIds: string[] = [];
      const mentionRegex = /@\[.*?\]\((.*?)\)/g;
      let match;
      while ((match = mentionRegex.exec(content)) !== null) {
        taggedUserIds.push(match[1]);
      }
      updatePostMutation.mutate(taggedUserIds);
    } else if (confirmAction === 'cancel') {
      setShowConfirm(false);
      setContent(post.content || post.caption || '');
      onOpenChange(false);
    }
  };

  const fetchUsers = async (query: string, callback: (data: SuggestionDataItem[]) => void) => {
    if (!query) return;
    try {
      const res = await searchControllerSearchUsers({ q: query, page: 1, limit: 10 });
      const suggestions = res.data?.data.map((u: any) => ({
        id: u.id,
        display: u.username || u.email,
        avatar: u.avatar,
      })) || [];
      callback(suggestions);
    } catch (error) {
      console.error('Error fetching users:', error);
      callback([]);
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
            {updatePostMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Xong
          </Button>
        </div>
        
        <div className="p-4">
          <div className="mentions-input-wrapper relative border-none">
            <MentionsInput
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Viết nội dung..."
              className="mentions-input min-h-[120px] border-none focus-visible:ring-0 resize-none px-0 text-base shadow-none bg-transparent w-full"
              style={{
                control: { fontSize: '1rem', fontWeight: 'normal', outline: 'none', border: 'none' },
                input: { margin: 0, padding: 0, border: 'none', outline: 'none' },
                highlighter: { padding: 0, border: 'none' },
                suggestions: {
                  list: {
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.375rem',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 50,
                    marginTop: '24px'
                  },
                  item: {
                    padding: '8px 12px',
                    borderBottom: '1px solid hsl(var(--border))',
                  },
                },
              }}
            >
              <Mention
                trigger="@"
                data={fetchUsers}
                displayTransform={(id, display) => display}
                renderSuggestion={(suggestion, search, highlightedDisplay, index, focused) => (
                  <div className={`flex items-center gap-2 ${focused ? 'bg-muted rounded-sm' : ''} p-1 cursor-pointer hover:bg-muted`}>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={(suggestion as any).avatar || '/default-avatar.png'} className="object-cover" />
                      <AvatarFallback>{suggestion.display[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{suggestion.display}</span>
                  </div>
                )}
                style={{
                  color: '#3b82f6',
                  position: 'relative',
                  zIndex: 1
                }}
              />
            </MentionsInput>
          </div>
          
          {(post.medias?.length > 0 || post.images?.length > 0) && (
            <div className="mt-4 grid grid-cols-2 gap-2 opacity-70 pointer-events-none">
              {(post.medias || post.images).map((mediaUrl: string, i: number) => {
                const isVideo = /\.(mp4|webm|ogg)($|\?)/i.test(mediaUrl);
                return (
                  <div key={i} className="aspect-square bg-muted rounded-lg overflow-hidden border">
                    {isVideo ? (
                      <video src={mediaUrl} className="w-full h-full object-cover" />
                    ) : (
                      <img src={mediaUrl} alt="media" className="w-full h-full object-cover" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
