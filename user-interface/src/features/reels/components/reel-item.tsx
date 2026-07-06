import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Send,
  Volume2,
  VolumeX,
  Play,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useUsersControllerGetProfile } from '@/services/apis/gen/queries';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface ReelData {
  id: string;
  videoUrl: string;
  caption: string;
  user: { id: string; username: string; full_name?: string; avatarUrl?: string; avatar?: string; privacy?: string };
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
  repostsCount?: number;
}

interface ReelItemProps {
  reel: ReelData;
  muted: boolean;
  onToggleMute: () => void;
  onOpenComments: () => void;
  onShare: (reel: ReelData) => void;
  onSave: (reel: ReelData) => void;
  onActive?: () => void;
}

  /**
  * Một reel chiếm trọn viewport. Video tự phát khi cuộn vào tầm nhìn
 * (IntersectionObserver) và tạm dừng khi rời đi.
 */
export function ReelItem({
  reel,
  muted,
  onToggleMute,
  onOpenComments,
  onShare,
  onSave,
  onActive,
}: ReelItemProps) {
  const { user: authUser } = useAuthStore();
  const isMe = authUser?.id === reel.user.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: profileRes, isLoading: isLoadingProfile } =
    useUsersControllerGetProfile(reel.user.id, {
      query: {
        enabled: !isMe,
        staleTime: 60000,
      },
    });

  const isFollowingApi =
    profileRes?.data?.is_following ||
    (profileRes?.data as any)?.isFollowing ||
    false;

  const [localIsFollowing, setLocalIsFollowing] = useState(isFollowingApi);
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalIsFollowing(isFollowingApi);
  }, [isFollowingApi]);

  const toggleFollowMutation = useMutation({
    mutationFn: (action: 'following' | 'none') =>
      orvalClient({
        url: '/relations/update',
        method: 'POST',
        data: { user_id: reel.user.id, relation: action },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', reel.user.id] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic toggle ngay lập tức
    const newStatus = !localIsFollowing;
    setLocalIsFollowing(newStatus);

    // Debounce gửi request
    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      // Chỉ gửi API nếu trạng thái cuối cùng khác với dữ liệu thực tế từ server
      if (newStatus !== isFollowingApi) {
        toggleFollowMutation.mutate(newStatus ? 'following' : 'none');
      }
    }, 500);
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Tỉ lệ khung hình (w/h) để khung video co giãn đúng và chọn cách bố trí tác giả.
  const [aspect, setAspect] = useState<number | null>(null);
  // Video ngang (>= 1): overlay tác giả lên video; video dọc: tác giả tách bên trái.
  const isWide = aspect != null && aspect >= 1;

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
  };

  // Khung video: dọc -> cao 86vh; ngang -> rộng tối đa; giữ đúng tỉ lệ thật.
  const videoBoxStyle: React.CSSProperties = aspect
    ? isWide
      ? { width: 'min(64vw, 820px)', maxWidth: '92vw', maxHeight: '86vh', aspectRatio: String(aspect) }
      : { height: '86vh', maxWidth: '92vw', aspectRatio: String(aspect) }
    : { height: '86vh', maxWidth: '92vw', aspectRatio: '9 / 16' };

  // Trạng thái tương tác (optimistic)
  const [liked, setLiked] = useState(reel.isLiked);
  const [likesCount, setLikesCount] = useState(reel.likesCount);
  const [saved, setSaved] = useState(!!reel.isSaved);
  const [reposted, setReposted] = useState(!!reel.isReposted);
  const [repostsCount, setRepostsCount] = useState(reel.repostsCount ?? 0);
  const [unrepostConfirmOpen, setUnrepostConfirmOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setLiked(reel.isLiked);
    setLikesCount(reel.likesCount);
    setSaved(!!reel.isSaved);
    setReposted(!!reel.isReposted);
    setRepostsCount(reel.repostsCount ?? 0);
    setIsExpanded(false);
    setAspect(null);
  }, [reel.id, reel.isLiked, reel.likesCount, reel.isSaved, reel.isReposted, reel.repostsCount]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.play().catch(() => {});
          if (onActive) onActive();
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (muted) {
      onToggleMute();
    }

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  // --- Mutations ---
  const reactionMutation = useMutation({
    mutationFn: () =>
      orvalClient({
        url: '/reactions',
        method: 'POST',
        data: { postId: reel.id, reaction: 'like' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postDetail', reel.id] });
    },
  });

  const handleLike = () => {
    const newStatus = !liked;
    setLiked(newStatus);
    setLikesCount((p) => (newStatus ? p + 1 : Math.max(0, p - 1)));
    reactionMutation.mutate();
  };

  const repostMutation = useMutation({
    mutationFn: () =>
      orvalClient({
        url: '/posts/share',
        method: 'POST',
        data: { post_id: reel.id },
      }),
  });

  // Bấm đăng lại: nếu đang đăng lại -> hỏi xác nhận hủy; nếu chưa -> đăng lại luôn.
  const handleRepost = () => {
    if (isMe) return;
    if (reposted) {
      setUnrepostConfirmOpen(true);
      return;
    }
    setReposted(true);
    setRepostsCount((p) => p + 1);
    repostMutation.mutate(undefined, {
      onSuccess: () => toast({ description: 'Đã đăng lại bài viết' }),
      onError: () => {
        setReposted(false);
        setRepostsCount((p) => Math.max(0, p - 1));
        toast({
          description: 'Không thể đăng lại. Thử lại sau.',
          variant: 'destructive',
        });
      },
    });
  };

  const confirmUnrepost = () => {
    setUnrepostConfirmOpen(false);
    setReposted(false);
    setRepostsCount((p) => Math.max(0, p - 1));
    repostMutation.mutate(undefined, {
      onSuccess: () => toast({ description: 'Đã hủy đăng lại bài viết' }),
      onError: () => {
        setReposted(true);
        setRepostsCount((p) => p + 1);
        toast({
          description: 'Không thể hủy đăng lại. Thử lại sau.',
          variant: 'destructive',
        });
      },
    });
  };

  // panel=true: hiển thị cạnh video trên nền theme (dùng token màu);
  // panel=false (mặc định): overlay trên video (chữ trắng).
  const renderAuthorInfo = (panel = false) => (
    <>
      <div className="flex items-center gap-2 mb-2 w-fit">
        <Link
          to={`/profile/${reel.user.id}`}
          className="flex items-center gap-2"
        >
          <Avatar
            className={`w-9 h-9 border ${panel ? 'border-border' : 'border-white/40'}`}
          >
            <AvatarImage src={getAvatarUrl(reel.user.avatarUrl || reel.user.avatar)} />
            <AvatarFallback className="bg-muted" />
          </Avatar>
          <span className="font-semibold text-sm">{getDisplayName(reel.user)}</span>
        </Link>
        {!isMe && !isLoadingProfile && (
          <>
            <span
              className={`text-xs ${panel ? 'text-muted-foreground' : 'text-white/60'}`}
            >
              •
            </span>
            <button
              onClick={handleFollow}
              className={`text-sm font-semibold transition-colors flex items-center justify-center pointer-events-auto ${
                localIsFollowing
                  ? panel
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-white/80 hover:text-white'
                  : 'text-blue-400 hover:text-blue-300'
              }`}
            >
              {localIsFollowing ? 'Đang theo dõi' : 'Theo dõi'}
            </button>
          </>
        )}
      </div>
      {reel.caption && (
        <div className="mt-1">
          <div
            className={`text-sm whitespace-pre-wrap ${
              panel ? 'text-foreground/90' : 'text-white/90'
            } ${
              isExpanded
                ? 'max-h-[200px] overflow-y-auto custom-scrollbar pr-2 pointer-events-auto'
                : 'line-clamp-2'
            }`}
          >
            {reel.caption}
          </div>
          {reel.caption.length > 80 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={`text-xs font-semibold mt-1 pointer-events-auto ${
                panel
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              {isExpanded ? 'Ẩn bớt' : 'Xem thêm'}
            </button>
          )}
        </div>
      )}
      <Link
        to={`/post/${reel.id}`}
        className={`text-xs mt-1 inline-block ${
          panel
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-white/60 hover:text-white/90'
        }`}
      >
        Xem bài viết
      </Link>
    </>
  );

  const renderActions = (panel = false) => {
    const chip = `p-3 rounded-full transition-colors ${
      panel ? 'bg-foreground/10 hover:bg-foreground/20' : 'bg-white/10 hover:bg-white/20'
    }`;
    return (
      <>
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <div className={chip}>
            <Heart
              className={`w-6 h-6 ${liked ? 'fill-red-500 text-red-500' : ''}`}
            />
          </div>
          <span className="text-xs">{likesCount}</span>
        </button>

        <button
          onClick={() => onOpenComments()}
          className="flex flex-col items-center gap-1"
        >
          <div className={chip}>
            <MessageCircle className="w-6 h-6" />
          </div>
          <span className="text-xs">{reel.commentsCount}</span>
        </button>

        {reel.user?.privacy !== 'private' && !isMe && (
          <button
            onClick={handleRepost}
            disabled={repostMutation.isPending}
            className="flex flex-col items-center gap-1 disabled:opacity-60"
          >
            <div className={chip}>
              <Share2 className={`w-6 h-6 ${reposted ? 'text-green-400' : ''}`} />
            </div>
            {repostsCount > 0 && <span className="text-xs">{repostsCount}</span>}
          </button>
        )}

        <button
          onClick={() => onShare(reel)}
          className="flex flex-col items-center gap-1"
        >
          <div className={chip}>
            <Send className="w-6 h-6" />
          </div>
        </button>

        <button
          onClick={() => {
            if (saved) return;
            onSave(reel);
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className={chip}>
            <Bookmark
              className={`w-6 h-6 ${
                saved ? 'fill-kyte-blue text-kyte-blue' : ''
              }`}
            />
          </div>
        </button>
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full snap-start snap-always flex flex-row items-center justify-center bg-background py-[2.5vh]"
    >
      {/* Desktop: Tác giả tách bên trái, sát video — CHỈ cho video DỌC.
          (Video ngang: tác giả overlay lên video như IG.) */}
      {!isWide && (
        <div className="hidden lg:flex flex-1 h-full flex-col justify-end items-end pb-[10vh] pr-3 min-w-0 pointer-events-auto text-foreground">
          <div className="w-full max-w-[300px]">{renderAuthorInfo(true)}</div>
        </div>
      )}
      {/* Video ngang: spacer trái để cụm [video + actions] căn giữa */}
      {isWide && <div className="hidden lg:block flex-1" />}

      {/* Khung video co giãn theo tỉ lệ thật */}
      <div
        className="relative shrink-0 max-w-full flex items-center justify-center bg-background rounded-xl overflow-hidden"
        style={videoBoxStyle}
      >
        <video
          ref={videoRef}
          src={reel.videoUrl}
          className="h-full w-full object-contain"
          loop
          muted={muted}
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Lớp overlay ẩn bắt sự kiện click cho toàn bộ video */}
        <div
          className="absolute inset-0 z-0 cursor-pointer"
          onClick={togglePlay}
        />

        {/* Biểu tượng play khi tạm dừng */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <Play className="w-16 h-16 text-white/80 fill-white/80" />
          </div>
        )}

        {/* Nút tắt/bật tiếng */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white z-10"
          aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
        >
          {muted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        {/* Overlay tác giả + hành động (Mobile & Tablet) */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 min-w-0 text-white pointer-events-auto">
              {renderAuthorInfo()}
            </div>
            <div className="flex flex-col items-center gap-4 text-white pointer-events-auto">
              {renderActions()}
            </div>
          </div>
        </div>

        {/* Desktop + video NGANG: overlay tác giả lên video (kiểu IG) */}
        {isWide && (
          <div className="hidden lg:block absolute bottom-0 left-0 right-0 p-4 pb-5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            <div className="max-w-[75%] text-white pointer-events-auto">
              {renderAuthorInfo()}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Nút tương tác — bám sát mép phải video, canh giữa dọc */}
      <div className="hidden lg:flex flex-col items-center gap-4 shrink-0 pl-3 text-foreground pointer-events-auto">
        {renderActions(true)}
      </div>

      {/* Spacer phải để cụm [video + actions] căn giữa cân đối */}
      <div className="hidden lg:block flex-1" />

      <ConfirmDialog
        open={unrepostConfirmOpen}
        onOpenChange={setUnrepostConfirmOpen}
        title="Hủy đăng lại bài viết này?"
        description="Bài đăng lại của bạn sẽ bị gỡ khỏi trang cá nhân."
        confirmText="Hủy đăng lại"
        destructive
        onConfirm={confirmUnrepost}
      />
    </div>
  );
}
