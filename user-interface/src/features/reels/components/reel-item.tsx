import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Repeat,
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

export interface ReelData {
  id: string;
  videoUrl: string;
  caption: string;
  user: { id: string; username: string; full_name?: string; avatarUrl?: string; avatar?: string; privacy?: string };
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved?: boolean;
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

  // Trạng thái tương tác (optimistic)
  const [liked, setLiked] = useState(reel.isLiked);
  const [likesCount, setLikesCount] = useState(reel.likesCount);
  const [saved, setSaved] = useState(!!reel.isSaved);
  const [reposted, setReposted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setLiked(reel.isLiked);
    setLikesCount(reel.likesCount);
    setSaved(!!reel.isSaved);
    setReposted(false);
    setIsExpanded(false);
  }, [reel.id]);

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

  const handleRepost = () => {
    if (reposted) return;
    setReposted(true);
    repostMutation.mutate();
  };

  const renderAuthorInfo = () => (
    <>
      <div className="flex items-center gap-2 mb-2 w-fit">
        <Link
          to={`/profile/${reel.user.id}`}
          className="flex items-center gap-2"
        >
          <Avatar className="w-9 h-9 border border-white/40">
            <AvatarImage src={getAvatarUrl(reel.user.avatarUrl || reel.user.avatar)} />
            <AvatarFallback className="bg-muted" />
          </Avatar>
          <span className="font-semibold text-sm">{getDisplayName(reel.user)}</span>
        </Link>
        {!isMe && !isLoadingProfile && (
          <>
            <span className="text-white/60 text-xs">•</span>
            <button
              onClick={handleFollow}
              className={`text-sm font-semibold transition-colors flex items-center justify-center pointer-events-auto ${
                localIsFollowing
                  ? 'text-white/80 hover:text-white'
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
            className={`text-sm text-white/90 whitespace-pre-wrap ${
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
              className="text-xs font-semibold text-white/60 hover:text-white/90 mt-1 pointer-events-auto"
            >
              {isExpanded ? 'Ẩn bớt' : 'Xem thêm'}
            </button>
          )}
        </div>
      )}
      <Link
        to={`/post/${reel.id}`}
        className="text-xs text-white/60 hover:text-white/90 mt-1 inline-block"
      >
        Xem bài viết
      </Link>
    </>
  );

  const renderActions = () => (
    <>
      <button onClick={handleLike} className="flex flex-col items-center gap-1">
        <div className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
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
        <div className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <MessageCircle className="w-6 h-6" />
        </div>
        <span className="text-xs">{reel.commentsCount}</span>
      </button>

      {reel.user?.privacy !== 'private' && (
        <button
          onClick={handleRepost}
          className="flex flex-col items-center gap-1"
        >
          <div className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <Repeat className={`w-6 h-6 ${reposted ? 'text-green-400' : ''}`} />
          </div>
        </button>
      )}

      <button
        onClick={() => onShare(reel)}
        className="flex flex-col items-center gap-1"
      >
        <div className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <Share2 className="w-6 h-6" />
        </div>
      </button>

      <button
        onClick={() => {
          if (saved) return;
          onSave(reel);
        }}
        className="flex flex-col items-center gap-1"
      >
        <div className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <Bookmark
            className={`w-6 h-6 ${
              saved ? 'fill-snet-purple text-snet-purple' : ''
            }`}
          />
        </div>
      </button>
    </>
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full snap-start snap-always flex flex-row items-center justify-center bg-black py-[2.5vh]"
    >
      {/* Giao diện Desktop: Thông tin tác giả (Bên trái) */}
      <div className="hidden lg:flex flex-1 h-full flex-col justify-end items-end pb-[10vh] pr-6 min-w-0 pointer-events-auto">
        <div className="text-white w-full max-w-[350px]">
          {renderAuthorInfo()}
        </div>
      </div>

      <div className="relative h-full max-h-[90vh] w-full sm:max-w-[450px] flex items-center justify-center shrink-0">
        <video
          ref={videoRef}
          src={reel.videoUrl}
          className="h-full w-full object-contain rounded-lg"
          loop
          muted={muted}
          playsInline
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

        {/* Overlay thông tin + hành động (Mobile & Tablet) */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg pointer-events-none">
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 min-w-0 text-white pointer-events-auto">
              {renderAuthorInfo()}
            </div>
            <div className="flex flex-col items-center gap-4 text-white pointer-events-auto">
              {renderActions()}
            </div>
          </div>
        </div>
      </div>

      {/* Giao diện Desktop: Nút tương tác (Bên phải) */}
      <div className="hidden lg:flex flex-1 h-full flex-col justify-end items-start pb-[10vh] pl-6 pointer-events-auto">
        <div className="flex flex-col items-center gap-4 text-white">
          {renderActions()}
        </div>
      </div>
    </div>
  );
}
