import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Smile,
  X,
  Repeat,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useState, useRef, useCallback } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { PostActionModal } from '@/features/posts/components/post-action-modal';
import { EditPostModal } from '@/features/posts/components/edit-post-modal';
import { useAuthStore } from '@/features/auth/stores/auth-store';

interface PostResponse {
  id: string;
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  createdAt: string;
  images: string[];
  caption: string;
  likesCount: number;
  commentsCount: number;
  repostsCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
}

interface PostDetailModalProps {
  post: PostResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDetailModal({
  post: initialPost,
  open,
  onOpenChange,
}: PostDetailModalProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [showEmoji, setShowEmoji] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    username: string;
    parentId?: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [actionOpen, setActionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [commentAction, setCommentAction] = useState<{
    id: string;
    userId: string;
  } | null>(null);

  // Lấy chi tiết bài viết (bao gồm comments mới nhất)
  const { data: queryData, isLoading } = useQuery({
    queryKey: ['postDetail', initialPost.id],
    queryFn: () =>
      orvalClient<any>({ url: `/posts/${initialPost.id}`, method: 'GET' }),
    enabled: open,
  });

  const post = queryData?.data || initialPost;
  const comments = post?.comments || [];
  const displayPost = post?.shared_post || post;
  const isRepost = !!post?.shared_post;
  const isMyPost = currentUser?.id === (post?.user?.id || initialPost.user.id);

  // Xây dựng cây bình luận
  const rootComments = comments.filter((c: any) => !c.parent_id);
  const getChildComments = (parentId: string) =>
    comments.filter((c: any) => c.parent_id === parentId);

  // Mutation Đăng bình luận
  const commentMutation = useMutation({
    mutationFn: (data: {
      content: string;
      post_id: string;
      parent_id?: string;
      tagged_users?: string[];
    }) => orvalClient({ url: '/comments', method: 'POST', data }),
    onSuccess: () => {
      setCommentText('');
      setReplyingTo(null);
      setShowEmoji(false);
      queryClient.invalidateQueries({
        queryKey: ['postDetail', initialPost.id],
      });
      queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/following'] });
      queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/foryou'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
    },
  });

  // Mutation Tương tác bình luận (Thích)
  const reactionMutation = useMutation({
    mutationFn: (data: {
      commentId?: string;
      postId?: string;
      reaction: string;
    }) => orvalClient({ url: '/reactions', method: 'POST', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['postDetail', initialPost.id],
      });
      queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/following'] });
      queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/foryou'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) =>
      orvalClient({ url: `/comments/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['postDetail', initialPost.id],
      });
      queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/following'] });
      queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/foryou'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
      setCommentAction(null);
    },
  });

  const handlePostComment = () => {
    if (!commentText.trim()) return;

    // Tìm tag user từ nội dung text (đơn giản hóa)
    const taggedUserIds: string[] = [];

    commentMutation.mutate({
      content: commentText,
      post_id: post?.id || initialPost.id,
      parent_id: replyingTo?.parentId || undefined,
      tagged_users: taggedUserIds,
    });
  };

  const handleReplyClick = (commentId: string, username: string) => {
    setReplyingTo({ id: commentId, username, parentId: commentId });
    setCommentText(`@${username} `);
    inputRef.current?.focus();
  };

  const pendingToggles = useRef<Record<string, number>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushToggles = useCallback(() => {
    Object.entries(pendingToggles.current).forEach(([id, count]) => {
      if (count % 2 !== 0) {
        // Odd number of clicks -> State changed -> Call API
        const isComment = id.startsWith('comment_');
        const actualId = id.replace(/^(comment|post)_/, '');
        reactionMutation.mutate({
          commentId: isComment ? actualId : undefined,
          postId: !isComment ? actualId : undefined,
          reaction: 'like',
        });
      }
    });
    pendingToggles.current = {};
  }, []);

  const queueToggle = useCallback((id: string, isComment: boolean) => {
    const key = isComment ? `comment_${id}` : `post_${id}`;
    pendingToggles.current[key] = (pendingToggles.current[key] || 0) + 1;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      flushToggles();
    }, 500);
  }, [flushToggles]);

  const handleLikePost = () => {
    queryClient.setQueryData(['postDetail', initialPost.id], (old: any) => {
      if (!old?.data) return old;
      const postData = old.data;
      const isCurrentlyLiked = postData.interactions?.is_liked;
      return {
        ...old,
        data: {
          ...postData,
          interactions: {
            ...postData.interactions,
            is_liked: !isCurrentlyLiked,
            likes: isCurrentlyLiked
              ? Math.max(0, (postData.interactions?.likes || 0) - 1)
              : (postData.interactions?.likes || 0) + 1,
          },
        }
      };
    });
    queueToggle(post?.id || initialPost.id, false);
  };

  const handleLikeComment = (commentId: string) => {
    queryClient.setQueryData(['postDetail', initialPost.id], (old: any) => {
      if (!old?.data) return old;
      const postData = old.data;
      return {
        ...old,
        data: {
          ...postData,
          comments: postData.comments?.map((c: any) => {
            if (c.id === commentId) {
              const isCurrentlyLiked = c.interactions?.is_liked;
              return {
                ...c,
                interactions: {
                  ...c.interactions,
                  is_liked: !isCurrentlyLiked,
                  likes: isCurrentlyLiked
                    ? Math.max(0, (c.interactions?.likes || 0) - 1)
                    : (c.interactions?.likes || 0) + 1,
                },
              };
            }
            return c;
          }),
        }
      };
    });
    queueToggle(commentId, true);
  };

  const repostMutation = useMutation({
    mutationFn: () =>
      orvalClient({
        url: '/posts/share',
        method: 'POST',
        data: { post_id: displayPost?.id || initialPost.id },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['postDetail', initialPost.id],
      });
      queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/following'] });
      queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/foryou'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
    },
  });

  const handleRepost = () => {
    repostMutation.mutate();
  };

  // Render 1 comment item
  const renderComment = (c: any, isChild = false) => {
    const isLiked = c.interactions?.is_liked;
    const likesCount = c.interactions?.likes || 0;

    return (
      <div key={c.id} className={`flex gap-3 mt-4 ${isChild ? 'ml-10' : ''}`}>
        <Link to={`/profile/${c.user.id}`} onClick={() => onOpenChange(false)}>
          <Avatar className="w-8 h-8 shrink-0 ring-1 ring-border">
            <AvatarImage
              src={c.user.avatar || '/default-avatar.png'}
              className="object-cover"
            />
            <AvatarFallback>{c.user.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col gap-1 flex-1">
          <div>
            <Link
              to={`/profile/${c.user.id}`}
              onClick={() => onOpenChange(false)}
            >
              <span className="font-semibold text-sm mr-2 hover:text-muted-foreground">
                {c.user.username}
              </span>
            </Link>
            <span className="text-sm whitespace-pre-wrap">{c.content}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-semibold">
            <span>{formatTimeAgo(c.created_at)}</span>
            {likesCount > 0 && <span>{likesCount} lượt thích</span>}
            <button
              className="hover:text-foreground transition-colors"
              onClick={() =>
                handleReplyClick(
                  c.parent_id ? c.parent_id : c.id,
                  c.user.username,
                )
              }
            >
              Trả lời
            </button>
            {(currentUser?.id === c.user.id ||
              currentUser?.id === post?.user?.id) && (
              <button
                className="hover:text-foreground transition-colors ml-1"
                onClick={() =>
                  setCommentAction({ id: c.id, userId: c.user.id })
                }
              >
                <MoreHorizontal className="w-3 h-3 inline-block" />
              </button>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 mt-1 text-muted-foreground self-start hover:bg-transparent"
          onClick={() => handleLikeComment(c.id)}
        >
          <Heart
            className={`w-3 h-3 ${isLiked ? 'fill-red-500 text-red-500' : ''}`}
          />
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] h-[85vh] p-0 flex flex-col overflow-hidden bg-card border-none rounded-xl gap-0">
        <DialogTitle className="sr-only">Chi tiết bài viết</DialogTitle>

        {/* Header (Cố định ở trên) */}
        {isRepost && (
          <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-muted-foreground bg-card">
            <Repeat className="w-4 h-4" />
            <span className="text-xs font-semibold">
              {post.user?.username || initialPost.user.username} đã đăng lại
            </span>
          </div>
        )}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Link
              to={`/profile/${displayPost?.user?.id}`}
              onClick={() => onOpenChange(false)}
            >
              <Avatar className="w-8 h-8 cursor-pointer">
                <AvatarImage
                  src={
                    displayPost?.user?.avatarUrl ||
                    displayPost?.user?.avatar ||
                    displayPost?.user?.profilePicture ||
                    '/default-avatar.png'
                  }
                  alt="Avatar"
                  className="object-cover"
                />
                <AvatarFallback>
                  {displayPost?.user?.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActionOpen(true)}
              >
                <MoreHorizontal className="w-5 h-5" />
              </Button>
              <Link
                to={`/profile/${displayPost?.user?.id}`}
                onClick={() => onOpenChange(false)}
              >
                <span className="font-semibold text-sm cursor-pointer hover:text-muted-foreground transition-colors">
                  {displayPost?.user?.username}
                </span>
              </Link>
              <span className="text-muted-foreground text-xs">•</span>
              <span className="text-muted-foreground text-xs">
                {formatTimeAgo(
                  displayPost?.createdAt ||
                    displayPost?.created_at ||
                    new Date().toISOString(),
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Nội dung bài viết + Hình ảnh + Bình luận (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
          {/* Nội dung Text bài viết */}
          {(displayPost?.caption || displayPost?.content) && (
            <div className="px-4 pt-3 pb-2 text-sm whitespace-pre-wrap break-words">
              {displayPost?.caption || displayPost?.content}
            </div>
          )}

          {/* Media bài viết */}
          {(displayPost?.images || displayPost?.medias || []).length > 0 && (
            <div className="w-full bg-black flex items-center justify-center">
              {(displayPost?.images || displayPost?.medias || []).length > 1 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {(displayPost?.images || displayPost?.medias || []).map(
                      (img: string, index: number) => (
                        <CarouselItem
                          key={index}
                          className="flex items-center justify-center"
                        >
                          {(() => {
                            const isVideo =
                              img.match(/\.(mp4|webm|mov|mkv)$/i) ||
                              img.includes('video');
                            return isVideo ? (
                              <video
                                src={img}
                                controls
                                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                              />
                            ) : (
                              <img
                                src={img}
                                alt={`Media ${index + 1}`}
                                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                              />
                            );
                          })()}
                        </CarouselItem>
                      ),
                    )}
                  </CarouselContent>
                  <CarouselPrevious className="left-4 opacity-50 hover:opacity-100 hidden sm:flex bg-background/50 border-none" />
                  <CarouselNext className="right-4 opacity-50 hover:opacity-100 hidden sm:flex bg-background/50 border-none" />
                </Carousel>
              ) : (
                (() => {
                  const url = (displayPost?.images || displayPost?.medias || [])[0];
                  const isVideo = url.match(/\.(mp4|webm|mov|mkv)$/i) || url.includes('video');
                  return isVideo ? (
                    <video
                      src={url}
                      controls
                      className="w-full h-auto object-contain rounded-lg max-h-[85vh]"
                    />
                  ) : (
                    <img
                      src={url}
                      alt="Post media"
                      className="w-full h-auto object-contain"
                    />
                  );
                })()
              )}
            </div>
          )}

          {/* Actions Bài viết */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button
                  className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors"
                  onClick={handleLikePost}
                >
                  <Heart
                    className={`w-6 h-6 ${post?.interactions?.is_liked || initialPost.isLiked ? 'fill-red-500 text-red-500' : ''}`}
                  />
                  {((post?.interactions?.likes ?? initialPost.likesCount) ||
                    0) > 0 && (
                    <span className="text-sm font-semibold">
                      {(post?.interactions?.likes ?? initialPost.likesCount) ||
                        0}
                    </span>
                  )}
                </button>
                <button
                  className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors"
                  onClick={() => inputRef.current?.focus()}
                >
                  <MessageCircle className="w-6 h-6" />
                  {((post?.interactions?.comments ??
                    initialPost.commentsCount) ||
                    0) > 0 && (
                    <span className="text-sm font-semibold">
                      {(post?.interactions?.comments ??
                        initialPost.commentsCount) ||
                        0}
                    </span>
                  )}
                </button>
                <button
                  className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors disabled:opacity-50"
                  disabled={repostMutation.isPending || isMyPost}
                  onClick={handleRepost}
                >
                  <div className="relative inline-flex items-center justify-center">
                    <Repeat
                      className={`w-6 h-6 ${post?.interactions?.is_reposted || initialPost.isReposted ? 'text-green-500' : ''}`}
                    />
                  </div>
                  {((post?.interactions?.reposts ?? initialPost.repostsCount) ||
                    0) > 0 && (
                    <span
                      className={`text-sm font-semibold ${post?.interactions?.is_reposted || initialPost.isReposted ? 'text-green-500' : ''}`}
                    >
                      {(post?.interactions?.reposts ??
                        initialPost.repostsCount) ||
                        0}
                    </span>
                  )}
                </button>
                <button className="hover:text-muted-foreground transition-colors">
                  <Send className="w-6 h-6" />
                </button>
              </div>
              <button className="hover:text-muted-foreground transition-colors">
                <Bookmark
                  className={`w-6 h-6 ${post?.isSaved || initialPost.isSaved ? 'fill-current' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="w-full h-[1px] bg-border my-2"></div>

          {/* Danh sách Comments */}
          <div className="p-4 pt-0">
            {isLoading ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                Đang tải bình luận...
              </div>
            ) : rootComments.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                Chưa có bình luận nào. Hãy là người đầu tiên!
              </div>
            ) : (
              rootComments.map((rootComment: any) => (
                <div key={rootComment.id}>
                  {renderComment(rootComment)}
                  {/* Hiển thị các comment con của root comment */}
                  {getChildComments(rootComment.id).map((childComment: any) =>
                    renderComment(childComment, true),
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Thanh nhập Bình luận (Cố định ở dưới cùng) */}
        <div className="border-t border-border bg-card shrink-0 p-3 relative">
          {replyingTo && (
            <div className="flex items-center justify-between bg-muted p-2 px-3 rounded-t-lg text-xs mb-[-4px]">
              <span className="text-muted-foreground font-medium">
                Đang trả lời{' '}
                <span className="font-bold text-foreground">
                  @{replyingTo.username}
                </span>
              </span>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setCommentText('');
                }}
                className="hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {showEmoji && (
            <div className="absolute bottom-[60px] left-2 z-50 shadow-xl">
              <EmojiPicker
                onEmojiClick={(emoji) =>
                  setCommentText((prev) => prev + emoji.emoji)
                }
                autoFocusSearch={false}
              />
            </div>
          )}

          <div
            className={`flex items-center gap-3 bg-transparent border border-border rounded-full px-4 py-2 ${replyingTo ? 'rounded-tl-none rounded-tr-none border-t-0' : ''}`}
          >
            <button
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              <Smile className="w-5 h-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Thêm bình luận..."
              className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePostComment();
              }}
            />
            <button
              className="text-primary font-semibold text-sm disabled:opacity-50 shrink-0"
              disabled={!commentText.trim() || commentMutation.isPending}
              onClick={handlePostComment}
            >
              {commentMutation.isPending ? 'Đang gửi...' : 'Đăng'}
            </button>
          </div>
        </div>
      </DialogContent>

      {actionOpen && (
        <PostActionModal
          post={post || initialPost}
          open={actionOpen}
          onOpenChange={setActionOpen}
          onEditClick={() => {
            onOpenChange(false);
            setEditOpen(true);
          }}
        />
      )}

      {editOpen && (
        <EditPostModal
          post={post || initialPost}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {commentAction && (
        <Dialog
          open={!!commentAction}
          onOpenChange={(open) => !open && setCommentAction(null)}
        >
          <DialogContent className="sm:max-w-xs p-0 gap-0 overflow-hidden rounded-xl border-none">
            <DialogTitle className="sr-only">Xóa bình luận</DialogTitle>
            <button
              className="w-full p-4 text-sm font-bold text-red-500 hover:bg-muted transition-colors active:bg-muted/80"
              onClick={() =>
                commentAction && deleteCommentMutation.mutate(commentAction.id)
              }
            >
              Xóa
            </button>
            <div className="h-[1px] w-full bg-border"></div>
            <button
              className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80"
              onClick={() => setCommentAction(null)}
            >
              Hủy
            </button>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
