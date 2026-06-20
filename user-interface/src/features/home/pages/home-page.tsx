import { SidebarRight } from '@/layouts/components/sidebar-right';
import { MobileBottomNav } from '@/layouts/components/mobile-bottom-nav';

import {
  useFeedControllerGetFollowingFeedInfinite,
  useFeedControllerGetForYouFeedInfinite,
} from '@/services/apis/gen/queries';
import { useRecommendedFeed } from '@/features/home/hooks/use-recommended-feed';
import { FeedPostItem } from '@/features/home/components/feed-post-item';
import { StoryBar } from '@/features/stories/components/story-bar';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2, Compass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type FeedTab = 'following' | 'foryou' | 'recommended';

/** Trích danh sách post từ 1 page (xử lý các kiểu bọc response khác nhau). */
function extractPosts(page: any): any[] {
  if (Array.isArray(page)) return page;
  if (Array.isArray(page?.data)) return page.data;
  if (Array.isArray(page?.data?.data)) return page.data.data;
  return [];
}

export default function HomePage() {
  const { ref, inView } = useInView();
  const [activeTab, setActiveTab] = useState<FeedTab>('following');

  // ── Following feed (infinite) ──
  const followingQuery = useFeedControllerGetFollowingFeedInfinite(
    { limit: 10 },
    {
      query: {
        enabled: activeTab === 'following',
        getNextPageParam: (lastPage: any) => {
          const meta = lastPage.meta || lastPage.data?.meta;
          return meta?.has_more && meta?.next_cursor
            ? meta.next_cursor
            : undefined;
        },
      },
    },
  );

  // ── For You feed (infinite, theo engagement) ──
  const forYouQuery = useFeedControllerGetForYouFeedInfinite(
    { limit: 10 },
    {
      query: {
        enabled: activeTab === 'foryou',
        getNextPageParam: (lastPage: any) => {
          const meta = lastPage.meta || lastPage.data?.meta;
          return meta?.has_more && meta?.next_cursor
            ? meta.next_cursor
            : undefined;
        },
      },
    },
  );

  // ── Recommended feed (AI cá nhân hóa) ──
  const recommendedQuery = useRecommendedFeed(20, activeTab === 'recommended');

  const infiniteQuery = activeTab === 'foryou' ? forYouQuery : followingQuery;
  const isInfinite = activeTab !== 'recommended';

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = infiniteQuery;

  useEffect(() => {
    if (isInfinite && inView && hasNextPage) {
      fetchNextPage();
    }
  }, [isInfinite, inView, hasNextPage, fetchNextPage]);

  // Trạng thái + dữ liệu chung theo tab
  const status = isInfinite ? infiniteQuery.status : recommendedQuery.status;
  const posts: any[] = isInfinite
    ? (infiniteQuery.data?.pages ?? []).flatMap(extractPosts)
    : (recommendedQuery.data?.data ?? []);
  const recommendedSource = recommendedQuery.data?.meta?.source;

  return (
    <div className="flex justify-center w-full min-h-screen pb-20 sm:pb-0">
      {/* Center Feed Area */}
      <div className="flex flex-col w-full max-w-[470px] mt-2 sm:mt-6 px-0 sm:px-0 lg:translate-x-14">
        {/* Stories Bar */}
        <StoryBar />

        {/* Feed Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-0 mb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('following')}
            className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${
              activeTab === 'following'
                ? 'bg-gradient-to-r from-snet-purple to-snet-pink text-white shadow-lg shadow-snet-purple/20'
                : 'text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Đang theo dõi
            </span>
          </button>
          <button
            onClick={() => setActiveTab('recommended')}
            className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${
              activeTab === 'recommended'
                ? 'bg-gradient-to-r from-snet-pink to-snet-purple text-white shadow-lg shadow-snet-pink/20'
                : 'text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              Dành cho bạn
            </span>
          </button>
          <button
            onClick={() => setActiveTab('foryou')}
            className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${
              activeTab === 'foryou'
                ? 'bg-gradient-to-r from-snet-purple to-snet-blue text-white shadow-lg shadow-snet-purple/20'
                : 'text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5" />
              Khám phá
            </span>
          </button>
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
                  <div className="h-0.5 w-full bg-gradient-to-r from-snet-purple via-snet-pink to-snet-blue opacity-30" />
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
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-snet-purple/10 to-snet-pink/10 flex items-center justify-center mb-4 animate-float">
                <Compass className="w-10 h-10 text-snet-purple" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-heading">
                {activeTab === 'recommended'
                  ? 'Chưa có gợi ý cho bạn'
                  : 'Chào mừng bạn đến với SNet!'}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {activeTab === 'recommended'
                  ? 'Hãy tương tác (thích, lưu) với một vài bài viết để chúng tôi hiểu sở thích của bạn hơn.'
                  : 'Hãy theo dõi mọi người để thấy bài viết của họ trên bảng tin của bạn.'}
              </p>
            </div>
          ) : (
            <>
              {/* Banner gợi ý AI */}
              {activeTab === 'recommended' &&
                recommendedSource === 'personalized' && (
                  <div className="mx-4 sm:mx-0 mb-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-snet-purple/10 to-snet-pink/10 px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">
                      Gợi ý dựa trên sở thích và lịch sử tương tác của bạn.
                    </span>
                  </div>
                )}

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

              {/* Load more spinner (chỉ với feed infinite) */}
              {isInfinite && (
                <div
                  ref={ref}
                  className="py-8 flex flex-col items-center justify-center"
                >
                  {isFetchingNextPage && (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-snet-purple" />
                      <span className="text-sm text-muted-foreground">
                        Đang tải thêm...
                      </span>
                    </div>
                  )}
                  {!hasNextPage && !isFetchingNextPage && posts.length > 0 && (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-snet-purple/10 to-snet-pink/10 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 text-snet-purple/60" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Bạn đã xem hết tin
                      </span>
                    </div>
                  )}
                </div>
              )}
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
