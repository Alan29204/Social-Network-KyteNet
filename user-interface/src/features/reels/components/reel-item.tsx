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
import { useToast } from '@/hooks/use-toast';

export interface ReelData {
  id: string;
  videoUrl: string;
  caption: string;
  user: { id: string; username: string; avatarUrl?: string };
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved?: boolean;
}

interface ReelItemProps {
  reel: ReelData;
  muted: boolean;
  onToggleMute: (force?: boolean) => void;
  onOpenComments: (postId: string) => void;
  onShare: (reel: ReelData) => void;
  onSave: (reel: ReelData) => void;
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
}: ReelItemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  // Trạng thái tương tác (optimistic)
  const [liked, setLiked] = useState(reel.isLiked);
  const [likesCount, setLikesCount] = useState(reel.likesCount);
  const [saved, setSaved] = useState(!!reel.isSaved);
  const [reposted, setReposted] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    setLiked(reel.isLiked);
    setLikesCount(reel.likesCount);
    setSaved(!!reel.isSaved);
  }, [reel.isLiked, reel.likesCount, reel.isSaved]);

  // Đảm bảo đồng bộ thuộc tính muted thực tế của DOM với state của React
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
          video.play().catch((err) => {
            console.warn('Autoplay failed:', err);
            if (err.name === 'NotAllowedError' && !video.muted) {
              video.muted = true;
              video.play().catch(() => {});
              onToggleMute(true);
            }
          });
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
    // Lần chạm đầu cũng bật tiếng nếu đang tắt
    if (muted) onToggleMute();
    if (video.paused) video.play();
    else video.pause();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['postDetail', reel.id] });
    },
  });

  const handleRepost = () => {
    if (reposted) return;
    setReposted(true);
    toast({
      title: 'Đã chia sẻ lại bài viết',
    });
    repostMutation.mutate();
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full snap-start snap-always flex items-center justify-center bg-black py-[2.5vh]"
    >
      <div className="relative h-full max-h-[90vh] w-full sm:max-w-[450px] flex items-center justify-center">
        <video
          ref={videoRef}
          src={reel.videoUrl}
          className="h-full w-full object-contain rounded-lg"
          loop
          muted={muted}
          playsInline
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Biểu tượng play khi tạm dừng */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Play className="w-16 h-16 text-white/80 fill-white/80" />
          </button>
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

        {/* Overlay thông tin + hành động */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg">
          <div className="flex items-end justify-between gap-4">
            {/* Thông tin tác giả */}
            <div className="flex-1 min-w-0 text-white">
              <Link
                to={`/profile/${reel.user.id}`}
                className="flex items-center gap-2 mb-2"
              >
                <Avatar className="w-9 h-9 border border-white/40">
                  <AvatarImage src={reel.user.avatarUrl} />
                  <AvatarFallback>
                    {reel.user.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm">
                  {reel.user.username}
                </span>
              </Link>
              {reel.caption && (
                <p className="text-sm line-clamp-2 text-white/90">
                  {reel.caption}
                </p>
              )}
              <Link
                to={`/post/${reel.id}`}
                className="text-xs text-white/60 hover:text-white/90 mt-1 inline-block"
              >
                Xem bài viết
              </Link>
            </div>

            {/* Cột hành động */}
            <div className="flex flex-col items-center gap-4 text-white">
              <button
                onClick={handleLike}
                className="flex flex-col items-center gap-1"
              >
                <div className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <Heart
                    className={`w-6 h-6 ${
                      liked ? 'fill-red-500 text-red-500' : ''
                    }`}
                  />
                </div>
                <span className="text-xs">{likesCount}</span>
              </button>

              <button
                onClick={() => onOpenComments(reel.id)}
                className="flex flex-col items-center gap-1"
              >
                <div className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <span className="text-xs">{reel.commentsCount}</span>
              </button>

              <button
                onClick={handleRepost}
                className="flex flex-col items-center gap-1"
              >
                <div className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <Repeat
                    className={`w-6 h-6 ${reposted ? 'text-green-400' : ''}`}
                  />
                </div>
              </button>

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
                  if (saved) return; // đã lưu -> để modal xử lý ở trang cha nếu cần
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
