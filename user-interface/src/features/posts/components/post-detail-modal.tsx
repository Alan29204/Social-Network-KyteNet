import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselDots,
} from '@/components/ui/carousel';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Smile,
  X,
  Share2,
  FileX2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { searchControllerSearchUsers } from '@/services/apis/gen/queries';
import { MentionsInput, Mention, SuggestionDataItem } from 'react-mentions';
import { useState, useRef, useCallback, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { PostActionModal } from '@/features/posts/components/post-action-modal';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { EditPostModal } from '@/features/posts/components/edit-post-modal';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { PostContentRenderer } from '@/features/posts/components/post-content-renderer';
import { PostLikesModal } from '@/features/posts/components/post-likes-modal';
import { ReactionPicker } from '@/features/posts/components/reaction-picker';
import {
  isVideoPostMedia,
  normalizePostMediaUrl,
} from '@/features/posts/utils/post-card-mapper';
import {
  bumpPostCommentCount,
  applyPostReactionInLists,
} from '@/features/posts/utils/post-cache';

interface PostResponse {
  id: string;
  user: {
    id: string;
    username: string;
    full_name?: string;
    avatarUrl?: string;
    avatar?: string;
    profilePicture?: string;
    privacy?: string;
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
  defaultCommentId?: string | null;
  syncUrl?: boolean;
  /** 'theater' = bố cục chia đôi (media trái, nội dung+bình luận phải) khi bấm ảnh/video */
  variant?: 'default' | 'theater';
  canNavigatePrevious?: boolean;
  canNavigateNext?: boolean;
  isNavigatingNext?: boolean;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
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

export function PostDetailModal({
  post: initialPost,
  open,
  onOpenChange,
  defaultCommentId,
  syncUrl = false,
  variant = 'default',
  canNavigatePrevious,
  canNavigateNext,
  isNavigatingNext,
  onNavigatePrevious,
  onNavigateNext,
}: PostDetailModalProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [searchParams] = useSearchParams();
  const targetCommentId = defaultCommentId || searchParams.get('commentId');
  const { toast } = useToast();
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
  const [likesOpen, setLikesOpen] = useState(false);
  const [commentAction, setCommentAction] = useState<{
    id: string;
    username: string;
    content: string;
    isOwner: boolean;
    canDelete: boolean;
  } | null>(null);
  const [editingComment, setEditingComment] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [reportComment, setReportComment] = useState<{ id: string } | null>(
    null,
  );
  const [reportReason, setReportReason] = useState<string>('spam');

  // Lấy chi tiết bài viết (bao gồm comments mới nhất)
  const {
    data: queryData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['postDetail', initialPost.id],
    queryFn: () =>
      orvalClient<any>({ url: `/posts/${initialPost.id}`, method: 'GET' }),
    enabled: open,
  });

  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  // Tự đặt con trỏ vào ô bình luận khi mở bài (trừ khi đang nhảy tới 1 bình luận cụ thể)
  useEffect(() => {
    if (open && !targetCommentId) {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [open, targetCommentId]);

  useEffect(() => {
    if (open && syncUrl) {
      const isAlreadyOnRoute = window.location.pathname.startsWith(
        `/post/${initialPost.id}`,
      );

      if (!isAlreadyOnRoute) {
        window.history.pushState(
          { isModal: true },
          '',
          `/post/${initialPost.id}`,
        );
      }

      const handlePopState = () => {
        onOpenChangeRef.current(false);
      };
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (!isAlreadyOnRoute && window.history.state?.isModal) {
          window.history.back();
        }
      };
    }
  }, [open, initialPost.id, syncUrl]);

  const isPostUnavailable =
    isError || (!isLoading && queryData && !queryData?.data);
  const post = queryData?.data || initialPost;
  const comments = sortCommentsForDisplay(post?.comments || []).filter(
    (comment: any) => comment?.id && comment?.user?.id,
  );
  const displayPost = post?.shared_post || post;
  const mediaUrls = (displayPost?.images || displayPost?.medias || []).map(
    (url: string) => normalizePostMediaUrl(url),
  );
  const isRepost = !!post?.shared_post;
  const isMyPost = currentUser?.id === (post?.user?.id || initialPost.user.id);
  // Bố cục chia đôi khi mở dạng theater và bài có media
  const isTheater = variant === 'theater' && mediaUrls.length > 0;

  // Khối media dùng chung (inline ở bố cục thường / cột trái ở theater)
  const mediaBlock =
    mediaUrls.length > 0 ? (
      mediaUrls.length > 1 ? (
        <Carousel className="w-full">
          <div className="relative w-full bg-muted flex items-center justify-center">
            <CarouselContent>
              {mediaUrls.map((img: string, index: number) => (
                <CarouselItem
                  key={index}
                  className="flex items-center justify-center"
                >
                  {(() => {
                    const isVideo = isVideoPostMedia(img);
                    return isVideo ? (
                      <video
                        src={img}
                        controls
                        className="max-w-full max-h-[92vh] object-contain rounded-lg"
                      />
                    ) : (
                      <img
                        src={img}
                        alt={`Media ${index + 1}`}
                        className="max-w-full max-h-[92vh] object-contain rounded-lg"
                      />
                    );
                  })()}
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-4 opacity-50 hover:opacity-100 hidden sm:flex bg-background/50 border-none" />
            <CarouselNext className="right-4 opacity-50 hover:opacity-100 hidden sm:flex bg-background/50 border-none" />
          </div>
          {/* Dots dưới media, trên nền card để dễ thấy */}
          <CarouselDots className="py-2.5" />
        </Carousel>
      ) : (
        <div className="w-full bg-muted flex items-center justify-center">
          {(() => {
            const url = mediaUrls[0];
            const isVideo = isVideoPostMedia(url);
            return isVideo ? (
              <video
                src={url}
                controls
                className="max-w-full h-auto object-contain rounded-lg max-h-[92vh] mx-auto"
              />
            ) : (
              <img
                src={url}
                alt="Post media"
                className="max-w-full max-h-[92vh] object-contain mx-auto"
              />
            );
          })()}
        </div>
      )
    ) : null;

  // Xây dựng cây bình luận
  const rootComments = comments.filter((c: any) => !c.parent_id);
  const getChildComments = (parentId: string) =>
    comments.filter((c: any) => c.parent_id === parentId);

  useEffect(() => {
    if (open && targetCommentId && !isLoading && rootComments.length > 0) {
      // Need a small timeout to ensure DOM is fully rendered before scrolling
      const timer = setTimeout(() => {
        const element = document.getElementById(`comment-${targetCommentId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-blue-500/20', 'dark:bg-blue-500/30');
          setTimeout(() => {
            element.classList.remove('bg-blue-500/20', 'dark:bg-blue-500/30');
          }, 1500);
        } else {
          toast({ title: 'Bình luận này đã bị xóa' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, targetCommentId, isLoading, rootComments.length, toast]);

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
      // Chỉ refetch dữ liệu RIÊNG của modal để hiện bình luận mới.
      // (react-query giữ data cũ khi refetch nên modal KHÔNG đóng/nháy.)
      queryClient.invalidateQueries({
        queryKey: ['postDetail', initialPost.id],
      });
      // Cập nhật số bình luận TẠI CHỖ ở feed/profile/search — KHÔNG refetch feed
      // nên feed không nhảy và modal không bị đóng.
      bumpPostCommentCount(queryClient, initialPost.id, 1);
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
      // Chỉ reconcile dữ liệu RIÊNG của modal; KHÔNG invalidate feed (tránh nhảy/đóng modal).
      // Số like/cảm xúc trên feed đã được cập nhật tại chỗ ở handleReactPost.
      queryClient.invalidateQueries({
        queryKey: ['postDetail', initialPost.id],
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) =>
      orvalClient({ url: `/comments/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['postDetail', initialPost.id],
      });
      bumpPostCommentCount(queryClient, initialPost.id, -1);
      setCommentAction(null);
      toast({ description: 'Đã xóa bình luận' });
    },
    onError: () =>
      toast({
        description: 'Không thể xóa bình luận.',
        variant: 'destructive',
      }),
  });

  const editCommentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      orvalClient({
        url: `/comments/${id}`,
        method: 'PATCH',
        data: { content },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['postDetail', initialPost.id],
      });
      setEditingComment(null);
      toast({ description: 'Đã cập nhật bình luận' });
    },
    onError: () =>
      toast({
        description: 'Không thể sửa bình luận.',
        variant: 'destructive',
      }),
  });

  const reportCommentMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      orvalClient({
        url: '/reports',
        method: 'POST',
        data: { type: 'comment', reported_comment_id: id, reason },
      }),
    onSuccess: () => {
      setReportComment(null);
      toast({ description: 'Đã gửi báo cáo. Cảm ơn bạn!' });
    },
    onError: () =>
      toast({
        description: 'Không thể gửi báo cáo. Thử lại sau.',
        variant: 'destructive',
      }),
  });

  const handlePostComment = () => {
    if (!commentText.trim()) return;

    const taggedUserIds: string[] = [];
    const mentionRegex = /@\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = mentionRegex.exec(commentText)) !== null) {
      taggedUserIds.push(match[1]);
    }

    commentMutation.mutate({
      content: commentText,
      post_id: post?.id || initialPost.id,
      parent_id: replyingTo?.parentId || undefined,
      tagged_users: taggedUserIds,
    });
  };

  const handleReplyClick = (
    commentId: string,
    displayName: string,
    userId: string,
  ) => {
    setReplyingTo({
      id: commentId,
      username: displayName,
      parentId: commentId,
    });
    setCommentText(`@[${displayName}](${userId}) `);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const fetchUsers = async (
    query: string,
    callback: (data: SuggestionDataItem[]) => void,
  ) => {
    if (!query) return;
    try {
      const res = await searchControllerSearchUsers({
        q: query,
        page: 1,
        limit: 10,
      });
      const suggestions =
        (res as any).data?.data?.map((u: any) => ({
          id: u.id,
          display: getDisplayName(u),
          avatarUrl: u.avatar,
        })) || [];
      callback(suggestions);
    } catch (error) {
      console.error('Error fetching users:', error);
      callback([]);
    }
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

  const queueToggle = useCallback(
    (id: string, isComment: boolean) => {
      const key = isComment ? `comment_${id}` : `post_${id}`;
      pendingToggles.current[key] = (pendingToggles.current[key] || 0) + 1;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        flushToggles();
      }, 500);
    },
    [flushToggles],
  );

  // Thả/đổi/gỡ cảm xúc (6 loại) cho BÀI VIẾT — optimistic + gọi thẳng /reactions.
  const handleReactPost = (type: string) => {
    queryClient.setQueryData(['postDetail', initialPost.id], (old: any) => {
      if (!old?.data) return old;
      const pd = old.data;
      const prev =
        pd.interactions?.my_reaction ??
        (pd.interactions?.is_liked ? 'like' : null);
      let likes = pd.interactions?.likes || 0;
      let next: string | null = type;
      if (prev === type) {
        next = null;
        likes = Math.max(0, likes - 1);
      } else if (prev == null) {
        likes = likes + 1;
      }
      return {
        ...old,
        data: {
          ...pd,
          interactions: {
            ...pd.interactions,
            my_reaction: next,
            is_liked: !!next,
            likes,
          },
        },
      };
    });
    // Đồng bộ số like + cảm xúc sang feed/profile TẠI CHỖ (không refetch -> không nhảy/đóng modal).
    const updatedPd: any = queryClient.getQueryData([
      'postDetail',
      initialPost.id,
    ]);
    const it = updatedPd?.data?.interactions;
    if (it) {
      applyPostReactionInLists(
        queryClient,
        initialPost.id,
        it.my_reaction ?? null,
        it.likes ?? 0,
      );
    }
    reactionMutation.mutate({
      postId: post?.id || initialPost.id,
      reaction: type,
    });
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
        },
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
      queryClient.invalidateQueries({
        queryKey: ['infinite', '/feed/following'],
      });
      queryClient.invalidateQueries({
        queryKey: ['infinite', '/feed/explore'],
      });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
    },
  });

  const handleRepost = () => {
    repostMutation.mutate();
  };

  // Render 1 comment item
  const renderComment = (c: any, isChild = false) => {
    if (!c?.user?.id) return null;

    const isLiked = c.interactions?.is_liked;
    const likesCount = c.interactions?.likes || 0;
    const editing =
      editingComment && editingComment.id === c.id ? editingComment : null;

    return (
      <div
        key={c.id}
        id={`comment-${c.id}`}
        className={`flex gap-3 mt-4 ${isChild ? 'ml-10' : ''} transition-colors duration-1000 p-1 -m-1 rounded-lg`}
      >
        <Link to={`/profile/${c.user.id}`} onClick={() => onOpenChange(false)}>
          <Avatar className="w-8 h-8 shrink-0 ring-1 ring-border">
            <AvatarImage
              src={getAvatarUrl(c.user.avatar)}
              className="object-cover"
            />
            <AvatarFallback className="bg-muted" />
          </Avatar>
        </Link>
        <div className="flex flex-col gap-1 flex-1">
          <div>
            <Link
              to={`/profile/${c.user.id}`}
              onClick={() => onOpenChange(false)}
            >
              <span className="font-semibold text-sm mr-2 hover:text-muted-foreground">
                {getDisplayName(c.user)}
              </span>
            </Link>
            {editing ? (
              <span className="inline-flex items-center gap-2 align-middle">
                <input
                  autoFocus
                  value={editing.content}
                  onChange={(e) =>
                    setEditingComment({ id: c.id, content: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editing.content.trim()) {
                      editCommentMutation.mutate({
                        id: c.id,
                        content: editing.content.trim(),
                      });
                    } else if (e.key === 'Escape') {
                      setEditingComment(null);
                    }
                  }}
                  className="text-sm bg-secondary rounded-md px-2 py-1 outline-none min-w-[160px]"
                />
                <button
                  className="text-xs font-semibold text-kyte-blue"
                  onClick={() =>
                    editing.content.trim() &&
                    editCommentMutation.mutate({
                      id: c.id,
                      content: editing.content.trim(),
                    })
                  }
                >
                  Lưu
                </button>
                <button
                  className="text-xs text-muted-foreground"
                  onClick={() => setEditingComment(null)}
                >
                  Hủy
                </button>
              </span>
            ) : (
              <span className="text-sm whitespace-pre-wrap">
                <PostContentRenderer
                  content={c.content}
                  taggedUsers={c.tagged_users}
                />
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-semibold">
            <span>{formatTimeAgo(c.created_at)}</span>
            {likesCount > 0 && <span>{likesCount} lượt thích</span>}
            <button
              className="hover:text-foreground transition-colors"
              onClick={() =>
                handleReplyClick(
                  c.parent_id ? c.parent_id : c.id,
                  getDisplayName(c.user),
                  c.user.id,
                )
              }
            >
              Trả lời
            </button>
            <button
              className="hover:text-foreground transition-colors ml-1"
              onClick={() =>
                setCommentAction({
                  id: c.id,
                  username: getDisplayName(c.user),
                  content: c.content,
                  isOwner: currentUser?.id === c.user.id,
                  canDelete:
                    currentUser?.id === c.user.id ||
                    currentUser?.id === post?.user?.id ||
                    (currentUser as any)?.role === 'admin',
                })
              }
            >
              <MoreHorizontal className="w-3 h-3 inline-block" />
            </button>
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

  if (isLoading && !initialPost.user?.id) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[420px] p-8 bg-card border-none rounded-xl">
          <DialogTitle className="sr-only">Đang tải bài viết</DialogTitle>
          <div className="flex justify-center py-8">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isPostUnavailable) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[420px] p-8 bg-card border-none rounded-xl">
          <DialogTitle className="sr-only">Bài viết không khả dụng</DialogTitle>
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileX2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                Bài viết không khả dụng
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Bài viết không tồn tại, đã bị xóa hoặc bạn không có quyền xem.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Nút điều hướng trước/sau — đặt ở rìa màn hình (ngoài khung bài viết) */}
      {open &&
        (onNavigatePrevious || onNavigateNext) &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[80] hidden sm:block">
            {onNavigatePrevious && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="pointer-events-auto absolute left-4 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-background/90 shadow-lg backdrop-blur hover:bg-background disabled:opacity-30"
                onClick={(event) => {
                  event.stopPropagation();
                  onNavigatePrevious();
                }}
                disabled={!canNavigatePrevious}
                aria-label="Bài viết trước"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
            {onNavigateNext && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="pointer-events-auto absolute right-4 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-background/90 shadow-lg backdrop-blur hover:bg-background disabled:opacity-30"
                onClick={(event) => {
                  event.stopPropagation();
                  onNavigateNext();
                }}
                disabled={!canNavigateNext || isNavigatingNext}
                aria-label="Bài viết tiếp theo"
              >
                {isNavigatingNext ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <ChevronRight className="h-6 w-6" />
                )}
              </Button>
            )}
          </div>,
          document.body,
        )}
      <DialogContent
        className={
          isTheater
            ? 'max-w-[1100px] w-[95vw] h-[96vh] p-0 flex flex-row overflow-hidden bg-card border-none rounded-2xl gap-0'
            : 'max-w-[600px] h-[85vh] p-0 flex flex-col overflow-hidden bg-card border-none rounded-xl gap-0'
        }
      >
        <DialogTitle className="sr-only">Chi tiết bài viết</DialogTitle>

        {/* Cột trái: media lớn (chỉ ở theater) */}
        {isTheater && (
          <div className="hidden md:flex flex-1 min-w-0 bg-muted items-center justify-center">
            <div className="w-full">{mediaBlock}</div>
          </div>
        )}

        {/* Cột phải (hoặc toàn bộ ở bố cục thường): nội dung + tương tác + bình luận */}
        <div
          className={
            isTheater
              ? 'flex flex-col w-full md:w-[440px] shrink-0 h-full min-w-0 border-l border-border'
              : 'flex flex-col h-full min-h-0 w-full'
          }
        >
          {/* Header (Cố định ở trên) */}
          {isRepost && (
            <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-muted-foreground bg-card">
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-semibold">
                {getDisplayName(post.user || initialPost.user)} đã đăng lại
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
                    src={getAvatarUrl(
                      displayPost?.user?.avatarUrl ||
                        displayPost?.user?.avatar ||
                        displayPost?.user?.profilePicture,
                    )}
                    alt="Avatar"
                    className="object-cover"
                  />
                  <AvatarFallback />
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
                    {getDisplayName(displayPost?.user)}
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
              <div className="px-4 pt-3 pb-2 text-sm">
                <PostContentRenderer
                  content={displayPost?.caption || displayPost?.content}
                  taggedUsers={
                    (displayPost as any)?.tagged_users ||
                    (initialPost as any)?.tagged_users
                  }
                />
              </div>
            )}

            {/* Media bài viết (chỉ inline ở bố cục thường; theater đưa sang cột trái) */}
            {!isTheater && mediaBlock}

            {/* Actions Bài viết */}
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <ReactionPicker
                    current={
                      post?.interactions?.my_reaction ??
                      (post?.interactions?.is_liked || initialPost.isLiked
                        ? 'like'
                        : null)
                    }
                    onReact={handleReactPost}
                  />
                  {((post?.interactions?.likes ?? initialPost.likesCount) ||
                    0) > 0 && (
                    <button
                      className="text-sm font-semibold hover:underline"
                      onClick={() => setLikesOpen(true)}
                    >
                      {(post?.interactions?.likes ?? initialPost.likesCount) ||
                        0}
                    </button>
                  )}
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
                  {displayPost?.user?.privacy !== 'private' && (
                    <button
                      className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors disabled:opacity-50"
                      disabled={repostMutation.isPending || isMyPost}
                      onClick={handleRepost}
                    >
                      <div className="relative inline-flex items-center justify-center">
                        <Share2
                          className={`w-6 h-6 ${post?.interactions?.is_reposted || initialPost.isReposted ? 'text-green-500' : ''}`}
                        />
                      </div>
                      {((post?.interactions?.reposts ??
                        initialPost.repostsCount) ||
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
                  )}
                  {displayPost?.user?.privacy !== 'private' && (
                    <button className="hover:text-muted-foreground transition-colors">
                      <Send className="w-6 h-6" />
                    </button>
                  )}
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
                  Chưa có bình luận nào. Hãy là người đầu tiên !
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
              <div className="flex items-center justify-between text-xs text-muted-foreground px-4 py-2 bg-muted/30">
                <span>Trả lời {replyingTo.username}</span>
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
              <div className="flex-1">
                <MentionsInput
                  inputRef={inputRef as any}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Thêm bình luận..."
                  className="mentions-input-comment"
                  onKeyDown={(e: any) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                  style={{
                    control: {
                      backgroundColor: 'transparent',
                      fontSize: 14,
                      fontWeight: 'normal',
                    },
                    highlighter: {
                      overflow: 'hidden',
                    },
                    input: {
                      margin: 0,
                      overflow: 'auto',
                      border: 'none',
                      outline: 'none',
                      padding: 0,
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
                      color: '#3b82f6',
                      position: 'relative',
                      zIndex: 1,
                    }}
                    renderSuggestion={(
                      suggestion,
                      _search,
                      highlightedDisplay,
                    ) => (
                      <div className="flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors cursor-pointer text-sm">
                        <Avatar className="w-6 h-6">
                          <AvatarImage
                            src={getAvatarUrl((suggestion as any).avatarUrl)}
                          />
                          <AvatarFallback className="bg-muted" />
                        </Avatar>
                        <span className="font-medium">
                          {highlightedDisplay}
                        </span>
                      </div>
                    )}
                  />
                </MentionsInput>
              </div>
              <button
                className="text-primary font-semibold text-sm disabled:opacity-50 shrink-0"
                disabled={!commentText.trim() || commentMutation.isPending}
                onClick={handlePostComment}
              >
                {commentMutation.isPending ? 'Đang gửi...' : 'Đăng'}
              </button>
            </div>
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
          onDeleted={() => {
            setActionOpen(false);
            onOpenChange(false);
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

      <PostLikesModal
        postId={displayPost?.id || initialPost.id}
        open={likesOpen}
        onOpenChange={setLikesOpen}
      />

      {commentAction && (
        <Dialog
          open={!!commentAction}
          onOpenChange={(open) => !open && setCommentAction(null)}
        >
          <DialogContent className="sm:max-w-xs p-0 gap-0 overflow-hidden rounded-xl border-none">
            <DialogTitle className="sr-only">Tùy chọn bình luận</DialogTitle>
            {commentAction.isOwner && (
              <>
                <button
                  className="w-full p-4 text-sm font-semibold hover:bg-muted transition-colors active:bg-muted/80"
                  onClick={() => {
                    setEditingComment({
                      id: commentAction.id,
                      content: commentAction.content,
                    });
                    setCommentAction(null);
                  }}
                >
                  Sửa
                </button>
                <div className="h-[1px] w-full bg-border"></div>
              </>
            )}
            {commentAction.canDelete && (
              <>
                <button
                  className="w-full p-4 text-sm font-bold text-red-500 hover:bg-muted transition-colors active:bg-muted/80"
                  onClick={() => deleteCommentMutation.mutate(commentAction.id)}
                >
                  Xóa
                </button>
                <div className="h-[1px] w-full bg-border"></div>
              </>
            )}
            {!commentAction.isOwner && (
              <>
                <button
                  className="w-full p-4 text-sm font-semibold text-red-500 hover:bg-muted transition-colors active:bg-muted/80"
                  onClick={() => {
                    setReportComment({ id: commentAction.id });
                    setReportReason('spam');
                    setCommentAction(null);
                  }}
                >
                  Tố cáo
                </button>
                <div className="h-[1px] w-full bg-border"></div>
              </>
            )}
            <button
              className="w-full p-4 text-sm hover:bg-muted transition-colors active:bg-muted/80"
              onClick={() => setCommentAction(null)}
            >
              Hủy
            </button>
          </DialogContent>
        </Dialog>
      )}

      {reportComment && (
        <Dialog
          open={!!reportComment}
          onOpenChange={(open) => !open && setReportComment(null)}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogTitle>Tố cáo bình luận</DialogTitle>
            <div className="flex flex-col gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                Chọn lý do bạn muốn tố cáo bình luận này:
              </p>
              <div className="flex flex-col gap-1">
                {[
                  { value: 'spam', label: 'Spam' },
                  { value: 'harassment', label: 'Quấy rối' },
                  { value: 'violence', label: 'Bạo lực' },
                  { value: 'adult_content', label: 'Nội dung người lớn' },
                  { value: 'fake_info', label: 'Thông tin sai sự thật' },
                  { value: 'other', label: 'Khác' },
                ].map((r) => (
                  <label
                    key={r.value}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reportReason === r.value}
                      onChange={() => setReportReason(r.value)}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={reportCommentMutation.isPending}
                onClick={() =>
                  reportCommentMutation.mutate({
                    id: reportComment.id,
                    reason: reportReason,
                  })
                }
              >
                {reportCommentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Gửi báo cáo'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
