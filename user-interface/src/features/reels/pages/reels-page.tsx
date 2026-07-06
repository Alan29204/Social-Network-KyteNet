import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2, Film, ArrowLeft } from 'lucide-react';
import {
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from 'react-router-dom';
import { usePostsControllerFindAllInfinite } from '@/services/apis/gen/queries';
import { ReelItem, type ReelData } from '../components/reel-item';
import { ReelCommentPanel } from '../components/reel-comment-panel';
import { SharePostModal } from '@/features/posts/components/share-post-modal';
import { SaveToListModal } from '@/features/saved/components/save-to-list-modal';
import {
  isVideoPostMedia,
  normalizePostMediaUrl,
} from '@/features/posts/utils/post-card-mapper';

/** Lấy URL video đầu tiên từ mảng medias của post. */
function pickVideoUrl(medias: any[]): string | null {
  if (!Array.isArray(medias)) return null;
  for (const m of medias) {
    const url = typeof m === 'string' ? m : m?.url || m?.media_url;
    if (url && isVideoPostMedia(url)) return normalizePostMediaUrl(url);
  }
  return null;
}

export default function ReelsPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const scopedUserId = searchParams.get('user_id');
  const { ref, inView } = useInView();
  // Tự bật tiếng khi vào reels từ cú click video (state.unmute); mặc định im lặng.
  const [muted, setMuted] = useState(
    () => !(location.state as { unmute?: boolean } | null)?.unmute,
  );

  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);

  const [shareReel, setShareReel] = useState<ReelData | null>(null);
  const [saveReel, setSaveReel] = useState<ReelData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledToStart = useRef(false);
  const postsParams = useMemo(
    () => ({
      limit: 10,
      media_type: 'video',
      ...(scopedUserId ? { user_id: scopedUserId, is_repost: false } : {}),
    }),
    [scopedUserId],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    usePostsControllerFindAllInfinite(
      postsParams,
      {
        query: {
          initialPageParam: 1,
          getNextPageParam: (lastPage: any) => {
            const meta = lastPage?.data?.meta;
            if (meta && meta.page < meta.last_page) {
              return meta.page + 1;
            }
            return undefined;
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
        // Phòng thủ tầng 2: reel chỉ nhận bài có ĐÚNG 1 media và là video.
        const medias = post.medias || post.mediaUrls || [];
        if (!Array.isArray(medias) || medias.length !== 1) continue;
        const videoUrl = pickVideoUrl(medias);
        if (!videoUrl) continue;
        result.push({
          id: post.id,
          videoUrl,
          caption: post.content || '',
          user: {
            id: post.user?.id || '',
            username: post.user?.username || 'User',
            avatarUrl: post.user?.avatar || post.user?.profilePicture || '',
            privacy: post.user?.privacy,
          },
          likesCount: post.likesCount || post.interactions?.likes || 0,
          commentsCount: post.commentsCount || post.interactions?.comments || 0,
          isLiked: post.isLiked || post.interactions?.is_liked || false,
          isSaved: post.isSaved || post.interactions?.is_saved || false,
          isReposted: post.isReposted || post.interactions?.is_reposted || false,
          repostsCount: post.repostsCount || post.interactions?.reposts || 0,
        });
      }
    }
    return result;
  }, [data]);

  useEffect(() => {
    scrolledToStart.current = false;
    setIsCommentOpen(false);
    setActiveReelId(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [routeId, scopedUserId]);

  // Cuộn tới reel mục tiêu (/reels/:id) — dùng cả khi mở từ feed lẫn khi reload.
  useEffect(() => {
    if (scrolledToStart.current || !routeId || reels.length === 0) return;
    const el = document.getElementById(`reel-${routeId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      scrolledToStart.current = true;
      return;
    }

    // Chưa tải tới reel mục tiêu -> phân trang tiếp cho đến khi tìm thấy.
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [routeId, reels, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Đồng bộ URL sống theo reel đang xem để reload giữ nguyên vị trí.
  // Dùng replaceState thô: không trigger React Router re-render/refetch,
  // không tạo lịch sử Back thừa (useParams không đổi -> các effect trên không chạy lại).
  useEffect(() => {
    if (!activeReelId) return;
    const qs = scopedUserId ? `?user_id=${scopedUserId}` : '';
    const url = `/reels/${activeReelId}${qs}`;
    if (window.location.pathname + window.location.search !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [activeReelId, scopedUserId]);

  return (
    <div className="relative h-[100dvh] w-full bg-background flex overflow-hidden">
      {/* Khu vực video */}
      <div className="relative flex-1 h-full">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 p-4 pointer-events-none">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-foreground/10 text-foreground pointer-events-auto"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-foreground text-lg font-semibold flex items-center gap-2">
            <Film className="w-5 h-5" /> Reels
          </h1>
        </div>

        {status === 'pending' ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-foreground" />
          </div>
        ) : reels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 px-6 text-center">
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
                <Loader2 className="w-6 h-6 animate-spin text-foreground" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bình luận: desktop = thẻ nổi bên phải (không xê dịch video) / mobile = phủ toàn màn */}
      {isCommentOpen && activeReelId && (
        <div className="absolute z-30 inset-0 bg-background sm:inset-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[340px] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl sm:overflow-hidden">
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
