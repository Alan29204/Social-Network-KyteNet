import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, X } from 'lucide-react';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { MentionsInput, Mention, SuggestionDataItem } from 'react-mentions';
import { searchControllerSearchUsers } from '@/services/apis/gen/queries';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { PostContentRenderer } from '@/features/posts/components/post-content-renderer';

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
    mutationFn: (data: { content: string, post_id: string, tagged_users?: string[] }) =>
      orvalClient({
        url: '/comments',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['postDetail', postId] });
    },
  });

  const fetchUsers = async (query: string, callback: (data: SuggestionDataItem[]) => void) => {
    if (!query) return;
    try {
      const res = await searchControllerSearchUsers({ q: query, page: 1, limit: 10 });
      const suggestions = (res as any).data?.data?.map((u: any) => ({
        id: u.id,
        display: getDisplayName(u),
        avatarUrl: u.avatar
      })) || [];
      callback(suggestions);
    } catch (error) {
      console.error('Error fetching users:', error);
      callback([]);
    }
  };

  const handleSend = () => {
    if (!text.trim() || commentMutation.isPending) return;

    const taggedUserIds: string[] = [];
    const mentionRegex = /@\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      taggedUserIds.push(match[1]);
    }

    commentMutation.mutate({
      content: text,
      post_id: postId,
      tagged_users: taggedUserIds
    });
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
                  src={getAvatarUrl(c.user?.avatar || c.user?.profilePicture)}
                  className="object-cover"
                />
                <AvatarFallback className="bg-muted" />
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold mr-1.5">
                    {getDisplayName(c.user)}
                  </span>
                  <PostContentRenderer content={c.content} taggedUsers={c.tagged_users} />
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
            src={getAvatarUrl(currentUser?.avatar)}
            className="object-cover"
          />
          <AvatarFallback className="bg-muted" />
        </Avatar>
        <div className="flex-1 bg-secondary rounded-xl">
          <MentionsInput
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Thêm bình luận..."
            className="mentions-input-reel"
            style={{
              control: {
                backgroundColor: 'transparent',
                fontSize: 14,
                fontWeight: 'normal',
                padding: '8px 16px',
              },
              highlighter: {
                overflow: 'hidden',
                padding: '8px 16px',
              },
              input: {
                margin: 0,
                overflow: 'auto',
                border: 'none',
                outline: 'none',
                padding: '8px 16px',
              },
              suggestions: {
                list: {
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.375rem',
                  boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.1)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 50,
                  bottom: '100%',
                  marginBottom: '10px'
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
              displayTransform={(_id, display) => display}
              appendSpaceOnAdd={true}
              style={{
                color: 'hsl(var(--snet-purple))',
                position: 'relative',
                zIndex: 1
              }}
              renderSuggestion={(suggestion, _search, highlightedDisplay) => (
                <div className="flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors cursor-pointer text-sm">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={getAvatarUrl((suggestion as any).avatarUrl)} />
                    <AvatarFallback className="bg-muted" />
                  </Avatar>
                  <span className="font-medium">{highlightedDisplay}</span>
                </div>
              )}
            />
          </MentionsInput>
        </div>
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
