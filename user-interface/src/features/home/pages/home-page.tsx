import { SidebarRight } from '@/layouts/components/sidebar-right';
import { MobileBottomNav } from '@/layouts/components/mobile-bottom-nav';

import {
  useFeedControllerGetFollowingFeedInfinite,
  useFeedControllerGetExploreFeedInfinite,
  getFeedControllerGetExploreFeedInfiniteQueryKey,
  getFeedControllerGetFollowingFeedInfiniteQueryKey,
} from '@/services/apis/gen/queries';
import { FeedPostItem } from '@/features/home/components/feed-post-item';
import { FeedComposer } from '@/features/home/components/feed-composer';
import { StoryBar } from '@/features/stories/components/story-bar';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { Loader2, Compass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AXIOS_INSTANCE from '@/services/apis/axios-client';

type FeedTab = 'following' | 'explore';

/** Trích danh sách post từ 1 page (xử lý các kiểu bọc response khác nhau). */
function extractPosts(page: any): any[] {
  if (Array.isArray(page)) return page;
  if (Array.isArray(page?.data)) return page.data;
  if (Array.isArray(page?.data?.data)) return page.data.data;
  return [];
}

export default function HomePage() {
  const { ref, inView } = useInView();
  const [activeTab, setActiveTab] = useState<FeedTab>('explore');

  // ── Following feed (infinite) ──
  const followingQuery = useFeedControllerGetFollowingFeedInfinite(
    { limit: 10 },
    {
      query: {
        enabled: activeTab === 'following',
        staleTime: 5 * 60_000,
        getNextPageParam: (lastPage: any) => {
          const meta = lastPage.meta || lastPage.data?.meta;
          return meta?.has_more && meta?.next_cursor
            ? meta.next_cursor
            : undefined;
        },
      },
    },
  );

  // ── Explore feed (Khám phá — infinite, theo engagement) ──
  const exploreQuery = useFeedControllerGetExploreFeedInfinite(
    { limit: 10 },
    {
      query: {
        enabled: activeTab === 'explore',
        staleTime: 5 * 60_000,
        getNextPageParam: (lastPage: any) => {
          const meta = lastPage.meta || lastPage.data?.meta;
          return meta?.has_more && meta?.next_cursor
            ? meta.next_cursor
            : undefined;
        },
      },
    },
  );

  const infiniteQuery = activeTab === 'explore' ? exploreQuery : followingQuery;

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = infiniteQuery;

  // ── Nhớ vị trí cuộn riêng cho từng tab ──
  const queryClient = useQueryClient();
  const scrollPositions = useRef<Record<FeedTab, number>>({
    explore: 0,
    following: 0,
  });

  // Khôi phục vị trí cuộn đã lưu khi đổi tab (dữ liệu lấy từ cache RQ -> có ngay)
  useLayoutEffect(() => {
    window.scrollTo(0, scrollPositions.current[activeTab] ?? 0);
  }, [activeTab]);

  /** Bấm vào tab: đang mở -> làm mới; khác tab -> lưu vị trí cũ rồi chuyển. */
  const handleTabClick = (tab: FeedTab) => {
    if (tab === activeTab) {
      void refreshActiveTab();
      return;
    }
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(tab);
  };

  /** Chạm lại tab đang mở: cuộn lên đầu + tải mới (Explore đảo thứ tự). */
  const refreshActiveTab = async () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    scrollPositions.current[activeTab] = 0;
    if (activeTab === 'explore') {
      try {
        await AXIOS_INSTANCE.post('/feed/explore/refresh');
      } catch {
        /* nếu refresh lỗi vẫn tải lại danh sách hiện có */
      }
      await queryClient.resetQueries({
        queryKey: getFeedControllerGetExploreFeedInfiniteQueryKey({ limit: 10 }),
      });
    } else {
      await queryClient.resetQueries({
        queryKey: getFeedControllerGetFollowingFeedInfiniteQueryKey({
          limit: 10,
        }),
      });
    }
  };

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // Trạng thái + dữ liệu chung theo tab
  const status = infiniteQuery.status;
  const posts: any[] = (infiniteQuery.data?.pages ?? []).flatMap(extractPosts);

  return (
    <div className="flex justify-center w-full min-h-screen pb-20 sm:pb-0">
      {/* Center Feed Area */}
      <div className="flex flex-col w-full max-w-[470px] mt-2 sm:mt-6 px-0 sm:px-0 lg:translate-x-14">
        {/* Stories Bar */}
        <StoryBar />

        {/* Thanh tạo bài viết */}
        <div className="px-4 sm:px-0">
          <FeedComposer />
        </div>

        {/* Feed Tabs — Sliding Pill, dính đỉnh, rộng 75% thẻ bài, căn giữa */}
        <div className="sticky top-0 z-20 bg-background pt-2 pb-3 px-4 sm:px-0">
          <div className="relative flex w-3/4 mx-auto rounded-full bg-secondary/60 p-1">
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-r from-kyte-blue to-kyte-coral shadow-lg shadow-kyte-blue/25 transition-transform duration-300 ease-out"
              style={{
                transform:
                  activeTab === 'following'
                    ? 'translateX(100%)'
                    : 'translateX(0)',
              }}
            />
            <button
              onClick={() => handleTabClick('explore')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === 'explore'
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Compass className="w-4 h-4" />
              Khám phá
            </button>
            <button
              onClick={() => handleTabClick('following')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === 'following'
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Đang theo dõi
            </button>
          </div>
        </div>

        {/* Feed Content */}
        <div className="flex flex-col">
          {status === 'pending' ? (
            <div className="flex flex-col gap-6 px-4 sm:px-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-full rounded-2xl bg-card border border-border overflow-hidden"
                >
                  <div className="h-0.5 w-full bg-gradient-to-r from-kyte-blue via-kyte-coral to-kyte-blue opacity-30" />
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full shimmer" />
                    <div className="flex flex-col gap-2">
                      <div className="w-24 h-3 rounded shimmer" />
                      <div className="w-16 h-2 rounded shimmer" />
                    </div>
                  </div>
                  <div className="w-full h-[400px] shimmer" />
                  <div className="p-4 flex gap-4">
                    <div className="w-5 h-5 rounded shimmer" />
                    <div className="w-5 h-5 rounded shimmer" />
                    <div className="w-5 h-5 rounded shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Compass className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Không thể tải bảng tin
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="rounded-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Thử lại
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-kyte-blue/10 to-kyte-coral/10 flex items-center justify-center mb-4 animate-float">
                <Compass className="w-10 h-10 text-kyte-blue" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-heading">
                Chào mừng bạn đến với KyteNet!
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {activeTab === 'explore'
                  ? 'Chưa có nội dung để khám phá. Hãy quay lại sau nhé!'
                  : 'Hãy theo dõi mọi người để thấy bài viết của họ trên bảng tin của bạn.'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                {posts.map((post: any, index: number) => (
                  <div
                    key={`${post.id}-${index}`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <FeedPostItem post={post} />
                  </div>
                ))}
              </div>

              {/* Load more spinner */}
              <div
                ref={ref}
                className="py-8 flex flex-col items-center justify-center"
              >
                {isFetchingNextPage && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-kyte-blue" />
                    <span className="text-sm text-muted-foreground">
                      Đang tải thêm...
                    </span>
                  </div>
                )}
                {!hasNextPage && !isFetchingNextPage && posts.length > 0 && (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kyte-blue/10 to-kyte-coral/10 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-kyte-blue/60" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Bạn đã xem hết tin
                    </span>
                  </div>
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

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
