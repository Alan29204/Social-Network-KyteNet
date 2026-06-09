import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { Bookmark, Loader2 } from 'lucide-react';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { PostCard } from '@/features/home/components/post-card';
import { MobileBottomNav } from '@/layouts/components/mobile-bottom-nav';

function unwrap(res: any) {
  return res?.data?.data ?? res?.data;
}

export default function SavedPage() {
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['saved-posts'],
      initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        const res = await AXIOS_INSTANCE.get('/save-posts/me/list', {
          params: { page: pageParam, limit: 10 },
        });
        return unwrap(res);
      },
      getNextPageParam: (lastPage: any) => {
        const meta = lastPage?.meta;
        if (meta && meta.page < meta.total_pages) return meta.page + 1;
        return undefined;
      },
    });

  useEffect(() => {
    if (inView && hasNextPage) fetchNextPage();
  }, [inView, hasNextPage, fetchNextPage]);

  const items =
    data?.pages.flatMap((p: any) => (Array.isArray(p?.data) ? p.data : [])) ||
    [];

  return (
    <div className="flex justify-center w-full min-h-screen pb-20 sm:pb-0">
      <div className="flex flex-col w-full max-w-[470px] mt-2 sm:mt-6">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 sm:px-0 mb-4">
          <Bookmark className="w-6 h-6 text-snet-purple" />
          <h1 className="text-xl font-bold">Đã lưu</h1>
        </div>

        {status === 'pending' ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-snet-purple" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-snet-purple/10 to-snet-pink/10 flex items-center justify-center mb-4">
              <Bookmark className="w-10 h-10 text-snet-purple" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Chưa có bài viết đã lưu
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Nhấn biểu tượng đánh dấu trên bài viết để lưu lại xem sau.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {items.map((item: any) => {
              const post = item.post || item;
              return (
                <PostCard
                  key={item.id || post.id}
                  post={{
                    id: post.id,
                    user: {
                      id: post.user?.id || '',
                      username: post.user?.username || 'User',
                      avatarUrl:
                        post.user?.avatar || post.user?.profilePicture || '',
                    },
                    createdAt:
                      post.created_at ||
                      post.createdAt ||
                      new Date().toISOString(),
                    images: post.medias || post.mediaUrls || [],
                    caption: post.content || '',
                    likesCount: post.interactions?.likes || 0,
                    commentsCount: post.interactions?.comments || 0,
                    repostsCount: post.interactions?.reposts || 0,
                    isLiked: post.interactions?.is_liked || false,
                    isSaved: true,
                  }}
                />
              );
            })}

            <div ref={ref} className="py-8 flex justify-center">
              {isFetchingNextPage && (
                <Loader2 className="w-5 h-5 animate-spin text-snet-purple" />
              )}
            </div>
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
