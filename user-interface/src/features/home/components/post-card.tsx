import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Send,
  Check,
  Share2,
} from 'lucide-react';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PostDetailModal } from '@/features/posts/components/post-detail-modal';
import { MediaGrid } from '@/features/home/components/media-grid';
import { PostActionModal } from '@/features/posts/components/post-action-modal';
import { EditPostModal } from '@/features/posts/components/edit-post-modal';
import { SharePostModal } from '@/features/posts/components/share-post-modal';
import { SaveToListModal } from '@/features/saved/components/save-to-list-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import {
  FollowRelationStatus,
  useFollowStore,
} from '@/features/profile/stores/follow-store';
import { useFollowAction } from '@/features/profile/hooks/use-follow-action';
import { PostContentRenderer } from '@/features/posts/components/post-content-renderer';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { PostLikesModal } from '@/features/posts/components/post-likes-modal';

interface PostCardProps {
  post: {
    id: string;
    user: {
      id: string;
      username: string;
      full_name?: string;
      avatarUrl?: string;
      avatar?: string;
      profilePicture?: string;
      privacy?: string;
      isFollowing?: boolean;
      is_following?: boolean;
      relationStatus?: FollowRelationStatus;
      relation_status?: FollowRelationStatus;
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
    repostedBy?: { id: string; username: string; full_name?: string }[];
    shared_post?: any;
    tagged_users?: string[];
    hashtags?: string[];
    content?: string;
    created_at?: string;
  };
  showFollowButton?: boolean;
  videoClickMode?: 'detail' | 'reels';
  videoReelsUserId?: string;
}

/** Video trong feed: tự phát khi cuộn vào viewport, dừng khi rời đi. Click mở chế độ Reels. */
function FeedVideo({
  url,
  postId,
  onOpenReels,
}: {
  url: string;
  postId: string;
  onOpenReels: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      src={url}
      className="w-full max-h-[600px] object-cover cursor-pointer"
      loop
      muted
      playsInline
      onClick={() => onOpenReels(postId)}
    />
  );
}

export function PostCard({
  post,
  showFollowButton = false,
  videoClickMode = 'reels',
  videoReelsUserId,
}: PostCardProps) {
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const displayPost = post.shared_post || post;
  const isRepost = !!post.shared_post;
  const isMyPost = currentUser?.id === displayPost.user.id;

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [theaterOpen, setTheaterOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [unsaveConfirmOpen, setUnsaveConfirmOpen] = useState(false);
  const [unrepostConfirmOpen, setUnrepostConfirmOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const { toast } = useToast();

  // Local state for debounced optimistic repost
  const [localReposted, setLocalReposted] = useState(post.isReposted);
  const [localRepostsCount, setLocalRepostsCount] = useState(post.repostsCount);
  const likeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localLiked, setLocalLiked] = useState(post.isLiked);
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount);
  const [localSaved, setLocalSaved] = useState(post.isSaved);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalReposted(post.isReposted);
    setLocalRepostsCount(post.repostsCount);
    setLocalLiked(post.isLiked);
    setLocalLikesCount(post.likesCount);
    setLocalSaved(post.isSaved);
  }, [
    post.isReposted,
    post.repostsCount,
    post.isLiked,
    post.likesCount,
    post.isSaved,
  ]);

  const queryClient = useQueryClient();

  const reactionMutation = useMutation({
    mutationFn: (data: { postId: string; reaction: string }) =>
      orvalClient({ url: '/reactions', method: 'POST', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
      queryClient.invalidateQueries({
        queryKey: ['postDetail', displayPost.id],
      });
    },
  });

  const handleLikePost = () => {
    // Optimistic UI: Update local state immediately
    const newStatus = !localLiked;
    setLocalLiked(newStatus);
    setLocalLikesCount((prev) =>
      newStatus ? (prev || 0) + 1 : Math.max(0, (prev || 1) - 1),
    );

    // Debounce API call: Wait 500ms before sending to server to prevent spam clicks
    if (likeTimerRef.current) clearTimeout(likeTimerRef.current);
    likeTimerRef.current = setTimeout(() => {
      reactionMutation.mutate({ postId: displayPost.id, reaction: 'like' });
    }, 500);
  };

  const repostMutation = useMutation({
    mutationFn: () =>
      orvalClient({
        url: '/posts/share',
        method: 'POST',
        data: { post_id: displayPost.id },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
    },
  });

  // Bấm nút đăng lại: nếu đang đăng lại -> hỏi xác nhận hủy; nếu chưa -> đăng lại luôn.
  const handleRepost = () => {
    if (localReposted) {
      setUnrepostConfirmOpen(true);
      return;
    }
    setLocalReposted(true);
    setLocalRepostsCount((prev) => (prev || 0) + 1);
    repostMutation.mutate(undefined, {
      onSuccess: () => toast({ description: 'Đã đăng lại bài viết' }),
      onError: () => {
        // hoàn tác optimistic nếu lỗi
        setLocalReposted(false);
        setLocalRepostsCount((prev) => Math.max(0, (prev || 1) - 1));
        toast({ description: 'Không thể đăng lại. Thử lại sau.', variant: 'destructive' });
      },
    });
  };

  const confirmUnrepost = () => {
    setUnrepostConfirmOpen(false);
    setLocalReposted(false);
    setLocalRepostsCount((prev) => Math.max(0, (prev || 1) - 1));
    repostMutation.mutate(undefined, {
      onSuccess: () => toast({ description: 'Đã hủy đăng lại bài viết' }),
      onError: () => {
        setLocalReposted(true);
        setLocalRepostsCount((prev) => (prev || 0) + 1);
        toast({ description: 'Không thể hủy đăng lại. Thử lại sau.', variant: 'destructive' });
      },
    });
  };

  const unsaveMutation = useMutation({
    mutationFn: () =>
      orvalClient({
        url: '/save-posts',
        method: 'DELETE',
        data: { post_id: displayPost.id },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
      queryClient.invalidateQueries({ queryKey: ['save-lists'] });
    },
  });

  const handleToggleSave = () => {
    if (!localSaved) {
      // Chưa lưu -> mở modal chọn bộ sưu tập
      setSaveModalOpen(true);
    } else {
      // Đã lưu -> hỏi xác nhận trước khi bỏ lưu
      setUnsaveConfirmOpen(true);
    }
  };

  const confirmUnsave = () => {
    setUnsaveConfirmOpen(false);
    setLocalSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      unsaveMutation.mutate();
    }, 300);
  };

  const { optimisticFollows } = useFollowStore();
  const initialRelationStatus: FollowRelationStatus =
    displayPost.user.relationStatus ||
    displayPost.user.relation_status ||
    (displayPost.user.isFollowing || displayPost.user.is_following
      ? 'following'
      : 'none');
  const relationStatus =
    optimisticFollows[displayPost.user.id] || initialRelationStatus;
  const followAction = useFollowAction({
    ...displayPost.user,
    relationStatus,
  });
  const isFollowing = followAction.isFollowing;
  const isPendingFollow = followAction.isPendingFollow;

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    followAction.toggleFollow();
  };

  const handleOpenVideo = (id: string) => {
    if (videoClickMode === 'detail') {
      setIsDetailOpen(true);
      return;
    }

    const suffix = videoReelsUserId ? `?user_id=${videoReelsUserId}` : '';
    // state.unmute: tự bật tiếng vì đây là cú click có user-gesture.
    navigate(`/reels/${id}${suffix}`, { state: { unmute: true } });
  };

  const renderRepostedBy = () => {
    const reposters = post.repostedBy;
    if (!reposters || reposters.length === 0) return getDisplayName(post.user);
    if (reposters.length === 1) return getDisplayName(reposters[0]);
    if (reposters.length === 2)
      return `${getDisplayName(reposters[0])}, ${getDisplayName(reposters[1])}`;
    return `${getDisplayName(reposters[0])}, ${getDisplayName(reposters[1])} và ${reposters.length - 2} người khác`;
  };

  return (
    <article className="w-full max-w-[470px] mx-auto mb-6 animate-fade-in-up">
      {/* Repost indicator */}
      {isRepost && (
        <div className="px-4 pb-2 flex items-center gap-2 text-muted-foreground">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kyte-blue/10 to-kyte-coral/10 flex items-center justify-center">
            <Share2 className="w-3.5 h-3.5 text-kyte-blue" />
          </div>
          <span className="text-xs font-medium">
            <span className="font-semibold">{renderRepostedBy()}</span> đã đăng
            lại
          </span>
        </div>
      )}

      {/* Card Container with gradient border on hover */}
      <div className="relative rounded-2xl bg-card border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-kyte-blue/5 dark:hover:shadow-kyte-blue/10 card-hover">
        {/* Top gradient accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-kyte-blue via-kyte-coral to-kyte-blue opacity-60" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${displayPost.user.id}`} className="shrink-0">
              <div className="relative">
                <Avatar className="w-10 h-10 ring-2 ring-kyte-blue/20 ring-offset-2 ring-offset-background cursor-pointer transition-all hover:ring-kyte-blue/40">
                  <AvatarImage
                    src={getAvatarUrl(
                      displayPost.user.avatarUrl ||
                        displayPost.user.avatar ||
                        displayPost.user.profilePicture,
                    )}
                    alt={getDisplayName(displayPost.user)}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted" />
                </Avatar>
                {/* Online indicator (optional - can be dynamic) */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
              </div>
            </Link>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Link to={`/profile/${displayPost.user.id}`}>
                  <span className="font-semibold text-sm hover:text-kyte-blue transition-colors">
                    {getDisplayName(displayPost.user)}
                  </span>
                </Link>
                {showFollowButton && !isMyPost && (
                  <button
                    onClick={handleFollow}
                    disabled={followAction.isMutating}
                    className={`text-xs font-semibold transition-all px-2 py-0.5 rounded-full ${
                      isFollowing || isPendingFollow
                        ? 'text-muted-foreground bg-secondary hover:bg-secondary/80'
                        : 'text-white bg-gradient-to-r from-kyte-blue to-kyte-coral hover:opacity-90'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {isPendingFollow
                      ? 'Đã gửi yêu cầu'
                      : isFollowing
                        ? 'Đang theo dõi'
                        : 'Theo dõi'}
                  </button>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(
                  displayPost.createdAt ||
                    displayPost.created_at ||
                    new Date().toISOString(),
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActionOpen(true)}
              className="w-8 h-8 rounded-full"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Caption (Text Content) */}
        {(displayPost.caption || displayPost.content || (displayPost.hashtags && displayPost.hashtags.length > 0)) && (
          <div className="px-4 pb-3">
            <PostContentRenderer
              content={displayPost.caption || displayPost.content}
              taggedUsers={displayPost.tagged_users}
              hashtags={displayPost.hashtags}
              maxLength={150}
              onShowMore={() => setIsDetailOpen(true)}
            />
          </div>
        )}

        {/* Media (Images/Videos) with rounded corners */}
        {displayPost.images && displayPost.images.length > 0 && (
          <div className="w-full overflow-hidden">
            {displayPost.images.length > 1 ? (
              // Lưới ảnh/video (tối đa 3 ô, +N nếu nhiều hơn) — bấm mở theater
              <MediaGrid
                medias={displayPost.images}
                onOpen={() => setTheaterOpen(true)}
              />
            ) : (
              (() => {
                const url = displayPost.images[0];
                const isVideo =
                  url.match(/\.(mp4|webm|mov|mkv)$/i) || url.includes('video');
                return isVideo ? (
                  <FeedVideo
                    url={url}
                    postId={displayPost.id}
                    onOpenReels={handleOpenVideo}
                  />
                ) : (
                  <div className="overflow-hidden">
                    <img
                      src={url}
                      alt="Post media"
                      className="w-full h-auto max-h-[500px] object-cover cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                      onClick={() => setTheaterOpen(true)}
                      loading="lazy"
                    />
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-5">
            <button
              className="group transition-all"
              onClick={handleLikePost}
              aria-label={localLiked ? 'Bỏ thích bài viết' : 'Thích bài viết'}
            >
              <div
                className={`relative transition-all duration-200 ${localLiked ? 'scale-110' : 'group-hover:scale-110'}`}
              >
                <Heart
                  className={`w-5 h-5 transition-all duration-200 ${
                    localLiked
                      ? 'fill-red-500 text-red-500 animate-heart-beat'
                      : 'text-foreground/70 group-hover:text-red-400'
                  }`}
                />
              </div>
            </button>
            {localLikesCount > 0 && (
              <button
                className={`-ml-4 text-xs font-semibold hover:underline ${
                  localLiked ? 'text-red-500' : 'text-foreground/70'
                }`}
                onClick={() => setLikesOpen(true)}
              >
                {localLikesCount}
              </button>
            )}

            <button
              className="flex items-center gap-1.5 group transition-all"
              onClick={() => setIsDetailOpen(true)}
            >
              <MessageCircle className="w-5 h-5 text-foreground/70 group-hover:text-kyte-blue transition-colors" />
              {post.commentsCount > 0 && (
                <span className="text-xs font-semibold text-foreground/70">
                  {post.commentsCount}
                </span>
              )}
            </button>

            {displayPost.user?.privacy !== 'private' && (
              <button
                className="flex items-center gap-1.5 group transition-all disabled:opacity-50"
                onClick={handleRepost}
                disabled={repostMutation.isPending || isMyPost}
              >
                <div className="relative inline-flex items-center justify-center">
                  <Share2
                    className={`w-5 h-5 transition-colors ${
                      localReposted
                        ? 'text-green-500'
                        : 'text-foreground/70 group-hover:text-green-400'
                    }`}
                  />
                  {localReposted && (
                    <Check
                      className="w-2.5 h-2.5 absolute text-green-500 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                      strokeWidth={4}
                    />
                  )}
                </div>
                {(localRepostsCount ?? 0) > 0 && (
                  <span
                    className={`text-xs font-medium ${localReposted ? 'text-green-500' : 'text-foreground/70'}`}
                  >
                    {localRepostsCount}
                  </span>
                )}
              </button>
            )}

            <button
              className="group transition-all"
              onClick={() => setShareOpen(true)}
            >
              <Send className="w-5 h-5 text-foreground/70 group-hover:text-kyte-blue transition-colors" />
            </button>
          </div>
          <button
            className="group transition-all"
            onClick={handleToggleSave}
            aria-label={localSaved ? 'Bỏ lưu' : 'Lưu bài viết'}
          >
            <Bookmark
              className={`w-5 h-5 transition-colors ${
                localSaved
                  ? 'fill-kyte-blue text-kyte-blue'
                  : 'text-foreground/70 group-hover:text-kyte-blue'
              }`}
            />
          </button>
        </div>

        {/* Footer Info */}
        <div className="px-4 pb-4 pt-1 flex flex-col gap-1">
          {post.commentsCount > 0 && (
            <button
              className="text-muted-foreground text-xs text-left hover:text-kyte-blue transition-colors"
              onClick={() => setIsDetailOpen(true)}
            >
              Xem tất cả {post.commentsCount} bình luận
            </button>
          )}

          {/* Quick Add Comment */}
          <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
            <Avatar className="w-7 h-7">
              <AvatarImage
                src={getAvatarUrl(currentUser?.avatar)}
                className="object-cover"
              />
              <AvatarFallback className="bg-muted" />
            </Avatar>
            <input
              type="text"
              placeholder="Thêm bình luận..."
              className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-muted-foreground"
              onClick={() => setIsDetailOpen(true)}
              readOnly
            />
            <button
              className="text-xs font-semibold text-kyte-blue hover:text-kyte-coral transition-colors disabled:opacity-50"
              disabled
            >
              Đăng
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PostDetailModal
        post={displayPost}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />

      {/* Theater chia đôi khi bấm ảnh/video */}
      {theaterOpen && (
        <PostDetailModal
          post={displayPost}
          open={theaterOpen}
          onOpenChange={setTheaterOpen}
          variant="theater"
        />
      )}

      {actionOpen && (
        <PostActionModal
          post={displayPost}
          open={actionOpen}
          onOpenChange={setActionOpen}
          onEditClick={() => setEditOpen(true)}
          onDeleted={() => {
            setActionOpen(false);
            setIsDetailOpen(false);
          }}
        />
      )}

      {editOpen && (
        <EditPostModal
          post={displayPost}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {shareOpen && (
        <SharePostModal
          post={displayPost}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}

      {saveModalOpen && (
        <SaveToListModal
          postId={displayPost.id}
          open={saveModalOpen}
          onOpenChange={setSaveModalOpen}
          onSaved={() => setLocalSaved(true)}
        />
      )}

      <ConfirmDialog
        open={unsaveConfirmOpen}
        onOpenChange={setUnsaveConfirmOpen}
        title="Bỏ lưu bài viết này?"
        description="Bài viết sẽ được gỡ khỏi tất cả bộ sưu tập đã lưu của bạn."
        confirmText="Bỏ lưu"
        destructive
        onConfirm={confirmUnsave}
      />

      <ConfirmDialog
        open={unrepostConfirmOpen}
        onOpenChange={setUnrepostConfirmOpen}
        title="Hủy đăng lại bài viết này?"
        description="Bài đăng lại của bạn sẽ bị gỡ khỏi trang cá nhân."
        confirmText="Hủy đăng lại"
        destructive
        onConfirm={confirmUnrepost}
      />

      <PostLikesModal
        postId={displayPost.id}
        open={likesOpen}
        onOpenChange={setLikesOpen}
      />
    </article>
  );
}
