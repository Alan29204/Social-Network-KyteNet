import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useMarkStoryViewed, useDeleteStory, useStoryViewers } from '../api';
import type { StoryGroup } from '../types';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { normalizePostMediaUrl } from '@/features/posts/utils/post-card-mapper';

interface StoryViewerProps {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

const IMAGE_DURATION = 5000; // 5s mỗi ảnh/text

export function StoryViewer({
  groups,
  initialGroupIndex,
  onClose,
}: StoryViewerProps) {
  const currentUser = useAuthStore((s) => s.user);
  const markViewed = useMarkStoryViewed();
  const deleteStory = useDeleteStory();

  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>();
  const startRef = useRef<number>(0);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwner = currentUser?.id === group?.user.id;

  // Danh sách người đã xem (chỉ chủ story)
  const { data: viewers = [] } = useStoryViewers(story?.id ?? null, isOwner);

  // Đánh dấu đã xem mỗi khi sang story mới
  useEffect(() => {
    if (story && !isOwner && !story.is_viewed) {
      markViewed.mutate(story.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const goNextStory = useCallback(() => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
    setProgress(0);
  }, [group, storyIndex, groupIndex, groups.length, onClose]);

  const goPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((i) => i - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
    setProgress(0);
  }, [storyIndex, groupIndex, groups]);

  // Auto-advance bằng requestAnimationFrame (ảnh/text). Video chạy theo thời lượng thật.
  useEffect(() => {
    if (!story || paused) return;
    if (story.type === 'video') return; // video xử lý qua onTimeUpdate

    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const pct = Math.min((elapsed / IMAGE_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        goNextStory();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [story, paused, goNextStory]);

  // Điều khiển bàn phím
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNextStory();
      else if (e.key === 'ArrowLeft') goPrevStory();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNextStory, goPrevStory, onClose]);

  if (!group || !story) return null;

  const handleVideoTime = () => {
    const v = videoRef.current;
    if (v && v.duration) {
      setProgress((v.currentTime / v.duration) * 100);
    }
  };

  const handleDelete = () => {
    if (confirm('Xóa story này?')) {
      deleteStory.mutate(story.id, {
        onSuccess: () => {
          if (group.stories.length === 1) onClose();
          else goNextStory();
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
      {/* Nút đóng */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Đóng"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Điều hướng trước/sau */}
      <button
        onClick={goPrevStory}
        className="flex absolute left-2 sm:left-4 z-30 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white"
        aria-label="Trước"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={goNextStory}
        className="flex absolute right-2 sm:right-4 z-30 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white"
        aria-label="Sau"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Khung story */}
      <div className="relative w-full h-full sm:w-[400px] sm:h-[90vh] sm:rounded-xl overflow-hidden bg-black">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3">
          {group.stories.map((s, i) => (
            <div
              key={s.id}
              className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white"
                style={{
                  width:
                    i < storyIndex
                      ? '100%'
                      : i === storyIndex
                        ? `${progress}%`
                        : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header tác giả */}
        <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-2 px-3 pt-2">
          <Avatar className="w-8 h-8 border border-white/40">
            <AvatarImage src={getAvatarUrl(group.user.avatar)} />
            <AvatarFallback className="bg-muted" />
          </Avatar>
          <span className="text-white text-sm font-semibold drop-shadow">
            {getDisplayName(group.user)}
          </span>
          {isOwner && (
            <button
              onClick={handleDelete}
              className="ml-auto mr-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              aria-label="Xóa story"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Vùng tap trái/phải để chuyển */}
        <button
          onClick={goPrevStory}
          className="absolute left-0 top-0 w-1/3 h-full z-10"
          aria-label="Story trước"
        />
        <button
          onClick={goNextStory}
          className="absolute right-0 top-0 w-1/3 h-full z-10"
          aria-label="Story sau"
        />

        {/* Nội dung */}
        <div
          className="w-full h-full flex items-center justify-center"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          {story.type === 'video' ? (
            <video
              ref={videoRef}
              src={normalizePostMediaUrl(story.media_url || '')}
              className="w-full h-full object-contain"
              autoPlay
              muted
              playsInline
              onTimeUpdate={handleVideoTime}
              onEnded={goNextStory}
            />
          ) : story.type === 'image' ? (
            <img
              src={normalizePostMediaUrl(story.media_url || '')}
              alt="story"
              className="w-full h-full object-contain"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{
                background:
                  story.background ||
                  'linear-gradient(135deg, #8b5cf6, #ec4899)',
              }}
            >
              <p className="text-white text-2xl font-bold text-center break-words">
                {story.content}
              </p>
            </div>
          )}
        </div>

        {/* Số người xem (chủ story) */}
        {isOwner && (
          <button
            onClick={() => {
              setPaused(true);
              setViewersOpen(true);
            }}
            className="absolute bottom-4 left-3 z-20 flex items-center gap-1.5 text-white text-sm font-medium hover:text-white/80"
          >
            <Eye className="w-4 h-4" />
            <span>{viewers.length} người đã xem</span>
          </button>
        )}
      </div>

      {/* Danh sách người đã xem */}
      <Dialog
        open={viewersOpen}
        onOpenChange={(o) => {
          setViewersOpen(o);
          if (!o) setPaused(false);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Người đã xem ({viewers.length})</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto flex flex-col gap-1">
            {viewers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Chưa có ai xem story này.
              </p>
            ) : (
              viewers.map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-2">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={getAvatarUrl(v.avatar)} />
                    <AvatarFallback className="bg-muted" />
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getDisplayName(v)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{v.username}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
