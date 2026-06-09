import { useEffect, useMemo, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2, Film, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePostsControllerFindAllInfinite } from '@/services/apis/gen/queries';
import { ReelItem, type ReelData } from '../components/reel-item';

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
  const { ref, inView } = useInView();
  const [muted, setMuted] = useState(true);

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
        });
      }
    }
    return result;
  }, [data]);

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-white/10 text-white"
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
        <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none">
          {reels.map((reel) => (
            <div key={reel.id} className="h-full w-full">
              <ReelItem
                reel={reel}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
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
  );
}
