import { useInfiniteQuery } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Skeleton } from '@/components/ui/skeleton';
import { PostDetailModal } from '@/features/posts/components/post-detail-modal';
import { Play } from 'lucide-react';

export function VideoPostsGrid({ userId }: { userId: string }) {
  const { ref, inView } = useInView();
  const [selectedPost, setSelectedPost] = useState<any>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['posts', 'video', userId],
      queryFn: ({ pageParam = 1 }) =>
        orvalClient<any>({
          url: `/posts?user_id=${userId}&media_type=video&page=${pageParam}&limit=12`,
          method: 'GET',
        }),
      getNextPageParam: (lastPage) => {
        const meta = lastPage?.data;
        if (meta && meta.page < Math.ceil(meta.total / meta.limit)) {
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
    return <div className="text-center py-8 text-destructive">Lỗi tải video</div>;
  }

  const posts = data.pages.flatMap((page: any) => page.data?.data || []);

  if (posts.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Chưa có video nào</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1 md:gap-4 py-4">
        {posts.map((post: any) => {
          const firstVideo = post.medias?.find((m: string) => /\.(mp4|mov|webm)($|\?)/i.test(m)) || post.medias?.[0];
          return (
              <div 
                key={post.id} 
                className="aspect-[9/16] bg-black flex items-center justify-center rounded-sm overflow-hidden relative group cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setSelectedPost({ ...post, images: post.medias || post.mediaUrls || [] })}
              >
                {firstVideo ? (
                  <>
                    <video src={firstVideo} className="w-full h-full object-cover opacity-80" muted playsInline />
                    <Play className="absolute w-8 h-8 text-white opacity-80" />
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">Trống</span>
                )}
              </div>
            );
          })}
        </div>
        
        {selectedPost && (
          <PostDetailModal
            post={selectedPost}
            open={!!selectedPost}
            onOpenChange={(open) => !open && setSelectedPost(null)}
          />
        )}
      <div ref={ref} className="py-2 flex justify-center">
        {isFetchingNextPage && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
