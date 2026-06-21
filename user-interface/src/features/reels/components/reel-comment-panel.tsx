import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Loader2, Send, X } from 'lucide-react';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { MentionsInput, Mention, SuggestionDataItem } from 'react-mentions';
import { searchControllerSearchUsers } from '@/services/apis/gen/queries';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { PostContentRenderer } from '@/features/posts/components/post-content-renderer';
import { invalidatePostSurfaces } from '@/features/posts/utils/post-cache';

interface ReelCommentPanelProps {
  postId: string;
  onClose: () => void;
}

const sortCommentsForDisplay = (comments: any[]) => {
  const allComments = Array.isArray(comments) ? [...comments] : [];
  const roots = allComments
    .filter((comment) => !comment.parent_id)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  const children = allComments
    .filter((comment) => !!comment.parent_id)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  return [...roots, ...children];
};

export function ReelCommentPanel({ postId, onClose }: ReelCommentPanelProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    username: string;
    parentId: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['postDetail', postId],
    queryFn: () => orvalClient<any>({ url: `/posts/${postId}`, method: 'GET' }),
  });

  const post = (data as any)?.data || data;
  const comments: any[] = sortCommentsForDisplay(post?.comments || []);
  const rootComments = comments.filter((c: any) => !c.parent_id);
  const getChildComments = (parentId: string) =>
    comments.filter((c: any) => c.parent_id === parentId);

  const commentMutation = useMutation({
    mutationFn: (data: {
      content: string;
      post_id: string;
      parent_id?: string;
      tagged_users?: string[];
    }) =>
      orvalClient({
        url: '/comments',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      setText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['postDetail', postId] });
      invalidatePostSurfaces(queryClient, { postId });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: (data: { commentId: string; reaction: string }) =>
      orvalClient({
        url: '/reactions',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postDetail', postId] });
      invalidatePostSurfaces(queryClient, { postId });
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

  const updateCommentLikeInPost = (targetPost: any, commentId: string) => {
    if (!targetPost?.comments) return targetPost;

    return {
      ...targetPost,
      comments: targetPost.comments.map((comment: any) => {
        if (comment.id !== commentId) return comment;

        const isLiked = comment.interactions?.is_liked;
        return {
          ...comment,
          interactions: {
            ...comment.interactions,
            is_liked: !isLiked,
            likes: isLiked
              ? Math.max(0, (comment.interactions?.likes || 0) - 1)
              : (comment.interactions?.likes || 0) + 1,
          },
        };
      }),
    };
  };

  const optimisticToggleCommentLike = (commentId: string) => {
    queryClient.setQueryData(['postDetail', postId], (old: any) => {
      if (!old) return old;

      if (old?.data?.data?.comments) {
        return {
          ...old,
          data: {
            ...old.data,
            data: updateCommentLikeInPost(old.data.data, commentId),
          },
        };
      }

      if (old?.data?.comments) {
        return {
          ...old,
          data: updateCommentLikeInPost(old.data, commentId),
        };
      }

      if (old?.comments) {
        return updateCommentLikeInPost(old, commentId);
      }

      return old;
    });
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
      parent_id: replyingTo?.parentId,
      tagged_users: taggedUserIds
    });
  };

  const handleReplyClick = (comment: any) => {
    const displayName = getDisplayName(comment.user);
    setReplyingTo({
      id: comment.id,
      username: displayName,
      parentId: comment.parent_id || comment.id,
    });
    setText(`@[${displayName}](${comment.user.id}) `);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleLikeComment = (commentId: string) => {
    optimisticToggleCommentLike(commentId);
    reactionMutation.mutate({ commentId, reaction: 'like' });
  };

  const renderComment = (comment: any, isChild = false) => {
    const isLiked = comment.interactions?.is_liked;
    const likesCount = comment.interactions?.likes || 0;

    return (
      <div
        key={comment.id}
        className={`flex gap-3 ${isChild ? 'ml-10' : ''}`}
      >
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarImage
            src={getAvatarUrl(
              comment.user?.avatar || comment.user?.profilePicture,
            )}
            className="object-cover"
          />
          <AvatarFallback className="bg-muted" />
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-semibold mr-1.5">
              {getDisplayName(comment.user)}
            </span>
            <PostContentRenderer
              content={comment.content}
              taggedUsers={comment.tagged_users}
            />
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-semibold">
            <span>
              {formatTimeAgo(comment.created_at || new Date().toISOString())}
            </span>
            {likesCount > 0 && <span>{likesCount} lượt thích</span>}
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => handleReplyClick(comment)}
            >
              Trả lời
            </button>
          </div>
        </div>
        <button
          className="h-7 w-7 mt-1 flex items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={() => handleLikeComment(comment.id)}
          aria-label={isLiked ? 'Bỏ thích bình luận' : 'Thích bình luận'}
        >
          <Heart
            className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`}
          />
        </button>
      </div>
    );
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
          rootComments.map((comment: any) => (
            <div key={comment.id} className="space-y-3">
              {renderComment(comment)}
              <div className="space-y-3">
                {getChildComments(comment.id).map((childComment: any) =>
                  renderComment(childComment, true),
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border shrink-0">
        {replyingTo && (
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground bg-muted/30">
            <span>Trả lời {replyingTo.username}</span>
            <button
              onClick={() => {
                setReplyingTo(null);
                setText('');
              }}
              className="hover:text-foreground"
              aria-label="Hủy trả lời"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-3">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage
              src={getAvatarUrl(currentUser?.avatar)}
              className="object-cover"
            />
            <AvatarFallback className="bg-muted" />
          </Avatar>
          <div className="flex-1 bg-secondary rounded-xl">
            <MentionsInput
              inputRef={inputRef as any}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={replyingTo ? 'Viết câu trả lời...' : 'Thêm bình luận...'}
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
                    marginBottom: '10px',
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
                  zIndex: 1,
                }}
                renderSuggestion={(suggestion, _search, highlightedDisplay) => (
                  <div className="flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors cursor-pointer text-sm">
                    <Avatar className="w-6 h-6">
                      <AvatarImage
                        src={getAvatarUrl((suggestion as any).avatarUrl)}
                      />
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
    </div>
  );
}
