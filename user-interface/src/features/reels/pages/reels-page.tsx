import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2, Film, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostsControllerFindAllInfinite } from '@/services/apis/gen/queries';
import { ReelItem, type ReelData } from '../components/reel-item';
import { ReelCommentPanel } from '../components/reel-comment-panel';
import { SharePostModal } from '@/features/posts/components/share-post-modal';
import { SaveToListModal } from '@/features/saved/components/save-to-list-modal';

const VIDEO_REGEX = /\.(mp4|mov|webm|m4v)(\?.*)?$/i;

/** Lấy URL video đầu tiên từ mảng medias của post. */
function pickVideoUrl(medias: any[]): string | null {
  if (!Array.isArray(medias)) return null;
  for (const m of medias) {
    const url = typeof m === 'string' ? m : m?.url || m?.media_url;
    if (url && VIDEO_REGEX.test(url)) return url;
  }
  return null;
}

export default function ReelsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');
  const { ref, inView } = useInView();
  const [muted, setMuted] = useState(true);

  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);

  const [shareReel, setShareReel] = useState<ReelData | null>(null);
  const [saveReel, setSaveReel] = useState<ReelData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledToStart = useRef(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    usePostsControllerFindAllInfinite(
      { limit: 10, media_type: 'video' },
      {
        query: {
          getNextPageParam: (lastPage: any, allPages: any[]) => {
            const arr = Array.isArray(lastPage)
              ? lastPage
              : lastPage.data?.data || lastPage.data || [];
            return arr.length === 0 ? undefined : allPages.length + 1;
          },
        },
      },
    );

  useEffect(() => {
    if (inView && hasNextPage) fetchNextPage();
  }, [inView, hasNextPage, fetchNextPage]);

  // Gom tất cả post -> reel có video
  const reels: ReelData[] = useMemo(() => {
    if (!data?.pages) return [];
    const result: ReelData[] = [];
    for (const page of data.pages as any[]) {
      const posts = Array.isArray(page)
        ? page
        : page.data?.data || page.data || [];
      for (const post of posts) {
        const videoUrl = pickVideoUrl(post.medias || post.mediaUrls || []);
        if (!videoUrl) continue;
        result.push({
          id: post.id,
          videoUrl,
          caption: post.content || '',
          user: {
            id: post.user?.id || '',
            username: post.user?.username || 'User',
            avatarUrl: post.user?.avatar || post.user?.profilePicture || '',
          },
          likesCount: post.likesCount || post.interactions?.likes || 0,
          commentsCount: post.commentsCount || post.interactions?.comments || 0,
          isLiked: post.isLiked || post.interactions?.is_liked || false,
          isSaved: post.isSaved || false,
        });
      }
    }
    return result;
  }, [data]);

  // Cuộn tới reel được mở từ feed (?start=:id)
  useEffect(() => {
    if (scrolledToStart.current || !startId || reels.length === 0) return;
    const el = document.getElementById(`reel-${startId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      scrolledToStart.current = true;
    }
  }, [startId, reels]);

  return (
    <div className="fixed inset-0 z-40 bg-black flex">
      {/* Khu vực video */}
      <div className="relative flex-1 h-full">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/10 text-white pointer-events-auto"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-lg font-semibold flex items-center gap-2">
            <Film className="w-5 h-5" /> Reels
          </h1>
        </div>

        {status === 'pending' ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        ) : reels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/80 gap-3 px-6 text-center">
            <Film className="w-12 h-12 opacity-50" />
            <p className="text-sm">
              Chưa có video nào. Hãy đăng bài viết kèm video để tạo Reel!
            </p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
          >
            {reels.map((reel) => (
              <div
                key={reel.id}
                id={`reel-${reel.id}`}
                className="h-full w-full"
              >
                <ReelItem
                  reel={reel}
                  muted={muted}
                  onToggleMute={() => setMuted((m) => !m)}
                  onOpenComments={() => setIsCommentOpen(true)}
                  onShare={(r) => setShareReel(r)}
                  onSave={(r) => setSaveReel(r)}
                  onActive={() => setActiveReelId(reel.id)}
                />
              </div>
            ))}

            {/* Sentinel tải thêm */}
            <div ref={ref} className="h-20 flex items-center justify-center">
              {isFetchingNextPage && (
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cột bình luận (desktop: cột bên / mobile: phủ toàn màn) */}
      {isCommentOpen && activeReelId && (
        <div className="absolute inset-0 sm:static sm:inset-auto sm:w-[400px] sm:h-full sm:border-l sm:border-border z-30 bg-background">
          <ReelCommentPanel
            key={activeReelId}
            postId={activeReelId}
            onClose={() => setIsCommentOpen(false)}
          />
        </div>
      )}

      {/* Modals */}
      {shareReel && (
        <SharePostModal
          post={shareReel as any}
          open={!!shareReel}
          onOpenChange={(o) => !o && setShareReel(null)}
        />
      )}

      {saveReel && (
        <SaveToListModal
          postId={saveReel.id}
          open={!!saveReel}
          onOpenChange={(o) => !o && setSaveReel(null)}
        />
      )}
    </div>
  );
}
