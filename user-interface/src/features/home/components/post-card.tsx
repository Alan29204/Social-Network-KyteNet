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
  Bookmark,
  MoreHorizontal,
  Repeat,
  Check,
  Sparkles,
  Share2,
} from 'lucide-react';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PostDetailModal } from '@/features/posts/components/post-detail-modal';
import { PostActionModal } from '@/features/posts/components/post-action-modal';
import { EditPostModal } from '@/features/posts/components/edit-post-modal';
import { SharePostModal } from '@/features/posts/components/share-post-modal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useFollowStore } from '@/features/profile/stores/follow-store';

interface PostCardProps {
  post: {
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
    repostedBy?: { id: string; username: string }[];
    shared_post?: any;
  };
  showFollowButton?: boolean;
}

export function PostCard({ post, showFollowButton = false }: PostCardProps) {
  const { user: currentUser } = useAuthStore();
  const isMyPost = currentUser?.id === post.user.id;

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Local state for debounced optimistic repost
  const [localReposted, setLocalReposted] = useState(post.isReposted);
  const [localRepostsCount, setLocalRepostsCount] = useState(post.repostsCount);
  const repostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleRepost = () => {
    const newStatus = !localReposted;
    setLocalReposted(newStatus);
    setLocalRepostsCount((prev) =>
      newStatus ? (prev || 0) + 1 : Math.max(0, (prev || 1) - 1),
    );

    if (repostTimerRef.current) clearTimeout(repostTimerRef.current);
    repostTimerRef.current = setTimeout(() => {
      if (newStatus !== post.isReposted) {
        repostMutation.mutate();
      }
    }, 500);
  };

  const saveMutation = useMutation({
    mutationFn: (save: boolean) =>
      orvalClient({
        url: '/save-posts',
        method: save ? 'POST' : 'DELETE',
        data: { post_id: displayPost.id },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    },
  });

  const handleToggleSave = () => {
    const newStatus = !localSaved;
    setLocalSaved(newStatus);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMutation.mutate(newStatus);
    }, 400);
  };

  const displayPost = post.shared_post || post;
  const isRepost = !!post.shared_post;

  const { optimisticFollows, setOptimisticFollow } = useFollowStore();
  const isFollowing = optimisticFollows[displayPost.user.id] ?? false;

  const toggleFollowMutation = useMutation({
    mutationFn: (action: 'following' | 'none') =>
      orvalClient({
        url: '/relations/update',
        method: 'POST',
        data: { user_id: displayPost.user.id, relation: action },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['profile', displayPost.user.id],
      });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const newStatus = !isFollowing;
    setOptimisticFollow(displayPost.user.id, newStatus);

    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      toggleFollowMutation.mutate(newStatus ? 'following' : 'none');
    }, 500);
  };

  const renderRepostedBy = () => {
    const reposters = post.repostedBy;
    if (!reposters || reposters.length === 0) return post.user.username;
    if (reposters.length === 1) return reposters[0].username;
    if (reposters.length === 2)
      return `${reposters[0].username}, ${reposters[1].username}`;
    return `${reposters[0].username}, ${reposters[1].username} và ${reposters.length - 2} người khác`;
  };

  return (
    <article className="w-full max-w-[470px] mx-auto mb-6 animate-fade-in-up">
      {/* Repost indicator */}
      {isRepost && (
        <div className="px-4 pb-2 flex items-center gap-2 text-muted-foreground">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-snet-purple/10 to-snet-pink/10 flex items-center justify-center">
            <Repeat className="w-3.5 h-3.5 text-snet-purple" />
          </div>
          <span className="text-xs font-medium">
            <span className="font-semibold">{renderRepostedBy()}</span> đã đăng
            lại
          </span>
        </div>
      )}

      {/* Card Container with gradient border on hover */}
      <div className="relative rounded-2xl bg-card border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-snet-purple/5 dark:hover:shadow-snet-purple/10 card-hover">
        {/* Top gradient accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-snet-purple via-snet-pink to-snet-blue opacity-60" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${displayPost.user.id}`} className="shrink-0">
              <div className="relative">
                <Avatar className="w-10 h-10 ring-2 ring-snet-purple/20 ring-offset-2 ring-offset-background cursor-pointer transition-all hover:ring-snet-purple/40">
                  <AvatarImage
                    src={
                      displayPost.user.avatarUrl ||
                      displayPost.user.avatar ||
                      displayPost.user.profilePicture ||
                      '/default-avatar.png'
                    }
                    alt={displayPost.user.username}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-snet-purple to-snet-pink text-white text-xs">
                    {displayPost.user.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator (optional - can be dynamic) */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
              </div>
            </Link>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Link to={`/profile/${displayPost.user.id}`}>
                  <span className="font-semibold text-sm hover:text-snet-purple transition-colors">
                    {displayPost.user.username}
                  </span>
                </Link>
                {showFollowButton && !isMyPost && (
                  <button
                    onClick={handleFollow}
                    className={`text-xs font-semibold transition-all px-2 py-0.5 rounded-full ${
                      isFollowing
                        ? 'text-muted-foreground bg-secondary hover:bg-secondary/80'
                        : 'text-white bg-gradient-to-r from-snet-purple to-snet-pink hover:opacity-90'
                    }`}
                  >
                    {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
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
            {/* Premium badge */}
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-snet-purple/5 hover:text-snet-purple w-8 h-8 rounded-full"
            >
              <Sparkles className="w-4 h-4 text-snet-purple/60" />
            </Button>
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
        {(displayPost.caption || displayPost.content) && (
          <div className="px-4 pb-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {(displayPost.caption || displayPost.content).length > 150
                ? `${(displayPost.caption || displayPost.content).slice(0, 150)}...`
                : displayPost.caption || displayPost.content}
              {(displayPost.caption || displayPost.content).length > 150 && (
                <button
                  onClick={() => setIsDetailOpen(true)}
                  className="text-muted-foreground ml-1 hover:text-snet-purple text-xs"
                >
                  Xem thêm
                </button>
              )}
            </p>
          </div>
        )}

        {/* Media (Images/Videos) with rounded corners */}
        {displayPost.images && displayPost.images.length > 0 && (
          <div className="relative w-full overflow-hidden">
            {displayPost.images.length > 1 ? (
              <Carousel className="w-full">
                <CarouselContent>
                  {displayPost.images.map((url: string, index: number) => {
                    const isVideo =
                      url.match(/\.(mp4|webm|mov|mkv)$/i) ||
                      url.includes('video');
                    return (
                      <CarouselItem
                        key={index}
                        className="flex items-center justify-center"
                      >
                        {isVideo ? (
                          <video
                            src={url}
                            controls
                            className="w-full h-auto max-h-[500px] object-cover cursor-pointer"
                            onClick={() => setIsDetailOpen(true)}
                          />
                        ) : (
                          <img
                            src={url}
                            alt={`Post media ${index + 1}`}
                            className="w-full h-auto max-h-[500px] object-cover cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                            onClick={() => setIsDetailOpen(true)}
                            loading="lazy"
                          />
                        )}
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious className="left-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background border-none shadow-lg" />
                <CarouselNext className="right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background border-none shadow-lg" />
              </Carousel>
            ) : (
              (() => {
                const url = displayPost.images[0];
                const isVideo =
                  url.match(/\.(mp4|webm|mov|mkv)$/i) || url.includes('video');
                return isVideo ? (
                  <video
                    src={url}
                    controls
                    className="w-full h-auto max-h-[500px] object-cover cursor-pointer"
                    onClick={() => setIsDetailOpen(true)}
                  />
                ) : (
                  <div className="overflow-hidden">
                    <img
                      src={url}
                      alt="Post media"
                      className="w-full h-auto max-h-[500px] object-cover cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                      onClick={() => setIsDetailOpen(true)}
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
              className="flex items-center gap-1.5 group transition-all"
              onClick={handleLikePost}
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
              {localLikesCount > 0 && (
                <span
                  className={`text-xs font-semibold ${localLiked ? 'text-red-500' : 'text-foreground/70'}`}
                >
                  {localLikesCount}
                </span>
              )}
            </button>

            <button
              className="flex items-center gap-1.5 group transition-all"
              onClick={() => setIsDetailOpen(true)}
            >
              <MessageCircle className="w-5 h-5 text-foreground/70 group-hover:text-snet-blue transition-colors" />
              {post.commentsCount > 0 && (
                <span className="text-xs font-semibold text-foreground/70">
                  {post.commentsCount}
                </span>
              )}
            </button>

            <button
              className="flex items-center gap-1.5 group transition-all disabled:opacity-50"
              onClick={handleRepost}
              disabled={repostMutation.isPending || isMyPost}
            >
              <div className="relative inline-flex items-center justify-center">
                <Repeat
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

            <button
              className="group transition-all"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="w-5 h-5 text-foreground/70 group-hover:text-snet-blue transition-colors" />
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
                  ? 'fill-snet-purple text-snet-purple'
                  : 'text-foreground/70 group-hover:text-snet-purple'
              }`}
            />
          </button>
        </div>

        {/* Footer Info */}
        <div className="px-4 pb-4 pt-1 flex flex-col gap-1">
          {post.commentsCount > 0 && (
            <button
              className="text-muted-foreground text-xs text-left hover:text-snet-purple transition-colors"
              onClick={() => setIsDetailOpen(true)}
            >
              Xem tất cả {post.commentsCount} bình luận
            </button>
          )}

          {/* Quick Add Comment */}
          <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
            <Avatar className="w-7 h-7">
              <AvatarImage
                src={currentUser?.avatar || '/default-avatar.png'}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-snet-purple to-snet-pink text-white text-[10px]">
                {currentUser?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <input
              type="text"
              placeholder="Thêm bình luận..."
              className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-muted-foreground"
              onClick={() => setIsDetailOpen(true)}
              readOnly
            />
            <button
              className="text-xs font-semibold text-snet-purple hover:text-snet-pink transition-colors disabled:opacity-50"
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

      {actionOpen && (
        <PostActionModal
          post={displayPost}
          open={actionOpen}
          onOpenChange={setActionOpen}
          onEditClick={() => setEditOpen(true)}
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
    </article>
  );
}
