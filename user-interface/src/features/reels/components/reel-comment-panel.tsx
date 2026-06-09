import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, X } from 'lucide-react';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useAuthStore } from '@/features/auth/stores/auth-store';

interface ReelCommentPanelProps {
  postId: string;
  onClose: () => void;
}

export function ReelCommentPanel({ postId, onClose }: ReelCommentPanelProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [text, setText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['postDetail', postId],
    queryFn: () => orvalClient<any>({ url: `/posts/${postId}`, method: 'GET' }),
  });

  const post = (data as any)?.data || data;
  const comments: any[] = post?.comments || [];
  const rootComments = comments.filter((c: any) => !c.parent_id);

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      orvalClient({
        url: '/comments',
        method: 'POST',
        data: { content, post_id: postId },
      }),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['postDetail', postId] });
    },
  });

  const handleSend = () => {
    if (!text.trim() || commentMutation.isPending) return;
    commentMutation.mutate(text.trim());
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="font-semibold">
          Bình luận{rootComments.length > 0 && ` (${rootComments.length})`}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-secondary"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-snet-purple" />
          </div>
        ) : rootComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Chưa có bình luận nào. Hãy là người đầu tiên!
          </p>
        ) : (
          rootComments.map((c: any) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage
                  src={c.user?.avatar || c.user?.profilePicture}
                  className="object-cover"
                />
                <AvatarFallback className="text-xs">
                  {c.user?.username?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold mr-1.5">
                    {c.user?.username || 'User'}
                  </span>
                  {c.content}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(c.created_at || new Date().toISOString())}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarImage
            src={currentUser?.avatar || '/default-avatar.png'}
            className="object-cover"
          />
          <AvatarFallback className="text-xs">
            {currentUser?.username?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Thêm bình luận..."
          className="flex-1 bg-secondary rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-snet-purple"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || commentMutation.isPending}
          className="p-2 rounded-full text-snet-purple disabled:opacity-40"
          aria-label="Gửi"
        >
          {commentMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
