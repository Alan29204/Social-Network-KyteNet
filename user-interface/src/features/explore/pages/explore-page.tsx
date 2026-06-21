import { SidebarRight } from '@/layouts/components/sidebar-right';

import { useFeedControllerGetForYouFeedInfinite } from '@/services/apis/gen/queries';
import { FeedPostItem } from '@/features/home/components/feed-post-item';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2 } from 'lucide-react';

export default function ExplorePage() {
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useFeedControllerGetForYouFeedInfinite(
      {
        limit: 10,
      },
      {
        query: {
          getNextPageParam: (lastPage: any) => {
            // cursor pagination meta from feed API
            const meta = lastPage.meta || lastPage.data?.meta;
            if (meta && meta.has_more && meta.next_cursor) {
              return meta.next_cursor;
            }
            return undefined;
          },
        },
      },
    );

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  return (
    <div className="flex justify-center w-full min-h-screen pb-20 sm:pb-0">
      {/* Center Feed Area */}
      <div className="flex flex-col w-full max-w-[470px] mt-8 px-0 sm:px-0 lg:translate-x-14">
        <div className="flex flex-col">
          {status === 'pending' ? (
            <div className="flex flex-col gap-6 px-4 sm:px-0">
              <div className="w-full h-[600px] border border-border rounded-lg bg-card animate-pulse"></div>
              <div className="w-full h-[600px] border border-border rounded-lg bg-card animate-pulse"></div>
            </div>
          ) : status === 'error' ? (
            <div className="text-center text-destructive p-4">
              Đã xảy ra lỗi khi tải bảng tin khám phá.
            </div>
          ) : (
            <>
              {data?.pages?.map((page: any, i) => {
                const posts = Array.isArray(page)
                  ? page
                  : Array.isArray(page.data)
                    ? page.data
                    : Array.isArray(page.data?.data)
                      ? page.data.data
                      : [];
                return (
                  <div key={i} className="flex flex-col">
                    {posts.map((post: any) => (
                      <FeedPostItem key={post.id} post={post} />
                    ))}
                  </div>
                );
              })}

              {/* Load more spinner */}
              <div ref={ref} className="py-6 flex justify-center">
                {isFetchingNextPage && (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                )}
                {!hasNextPage &&
                  (data?.pages?.[0] as any)?.data?.length > 0 && (
                    <span className="text-muted-foreground text-sm">
                      Bạn đã xem hết tin
                    </span>
                  )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar Area (Only visible on lg+ screens) */}
      <div className="hidden lg:block ml-16 w-[350px] sticky top-6 h-fit translate-x-[25%]">
        <SidebarRight />
      </div>
    </div>
  );
}
