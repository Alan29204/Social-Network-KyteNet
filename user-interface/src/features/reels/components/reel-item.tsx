import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  Play,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface ReelData {
  id: string;
  videoUrl: string;
  caption: string;
  user: { id: string; username: string; avatarUrl?: string };
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

interface ReelItemProps {
  reel: ReelData;
  muted: boolean;
  onToggleMute: () => void;
}

/**
 * Một reel chiếm trọn viewport. Video tự phát khi cuộn vào tầm nhìn
 * (IntersectionObserver) và tạm dừng khi rời đi.
 */
export function ReelItem({ reel, muted, onToggleMute }: ReelItemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

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

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full snap-start snap-always flex items-center justify-center bg-black"
    >
      <video
        ref={videoRef}
        src={reel.videoUrl}
        className="h-full w-full object-contain sm:object-cover sm:max-w-[450px]"
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
        onClick={onToggleMute}
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
      <div className="absolute bottom-0 left-0 right-0 sm:max-w-[450px] sm:left-1/2 sm:-translate-x-1/2 p-4 pb-20 sm:pb-6 bg-gradient-to-t from-black/70 to-transparent">
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
          </div>

          {/* Cột hành động */}
          <div className="flex flex-col items-center gap-4 text-white">
            <button className="flex flex-col items-center gap-1">
              <div className="p-3 rounded-full bg-white/10">
                <Heart
                  className={`w-6 h-6 ${
                    reel.isLiked ? 'fill-red-500 text-red-500' : ''
                  }`}
                />
              </div>
              <span className="text-xs">{reel.likesCount}</span>
            </button>
            <Link
              to={`/post/${reel.id}`}
              className="flex flex-col items-center gap-1"
            >
              <div className="p-3 rounded-full bg-white/10">
                <MessageCircle className="w-6 h-6" />
              </div>
              <span className="text-xs">{reel.commentsCount}</span>
            </Link>
            <button className="flex flex-col items-center gap-1">
              <div className="p-3 rounded-full bg-white/10">
                <Share2 className="w-6 h-6" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
