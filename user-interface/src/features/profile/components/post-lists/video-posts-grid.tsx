import { useInfiniteQuery } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMediaThumbnail } from './media-grid-utils';

export function VideoPostsGrid({ userId }: { userId: string }) {
  const { ref, inView } = useInView();
  const navigate = useNavigate();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['posts', 'video', userId],
      queryFn: ({ pageParam = 1 }) =>
        orvalClient<any>({
          url: `/posts?user_id=${userId}&is_repost=false&media_type=video&page=${pageParam}&limit=12`,
          method: 'GET',
        }),
      getNextPageParam: (lastPage) => {
        const meta = lastPage?.data?.meta;
        if (meta && meta.page < meta.last_page) {
          return meta.page + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
    });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap((page: any) => page.data?.data || []) || [];

  const openProfileReels = (postId: string) => {
    // state.unmute: tự bật tiếng vì đây là cú click có user-gesture.
    navigate(`/reels/${postId}?user_id=${userId}`, {
      state: { unmute: true },
    });
  };

  if (status === 'pending') {
    return (
      <div className="grid grid-cols-3 gap-1 md:gap-2 max-w-4xl mx-auto py-4">
        {[...Array(9)].map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center py-8 text-destructive">Lỗi tải video</div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Chưa có video nào
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1 md:gap-4 py-4">
        {posts.map((post: any) => {
          const firstVideo = getMediaThumbnail(post, 'video');
          return (
            <div
              key={post.id}
              className="aspect-[9/16] bg-black flex items-center justify-center rounded-sm overflow-hidden relative group cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => openProfileReels(post.id)}
            >
              {firstVideo ? (
                <>
                  <video
                    src={firstVideo}
                    className="w-full h-full object-cover opacity-80"
                    muted
                    playsInline
                  />
                  <Play className="absolute w-8 h-8 text-white opacity-80" />
                </>
              ) : (
                <span className="text-muted-foreground text-sm">Trống</span>
              )}
            </div>
          );
        })}
      </div>
      <div ref={ref} className="py-2 flex justify-center">
        {isFetchingNextPage && (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
