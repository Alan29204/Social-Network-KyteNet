import { SidebarRight } from '@/layouts/components/sidebar-right';
import { MobileBottomNav } from '@/layouts/components/mobile-bottom-nav';

import { useFeedControllerGetFollowingFeedInfinite } from '@/services/apis/gen/queries';
import { PostCard } from '@/features/home/components/post-card';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2, Compass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { ref, inView } = useInView();
  const [activeTab, setActiveTab] = useState<'following' | 'foryou'>(
    'following',
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useFeedControllerGetFollowingFeedInfinite(
      {
        limit: 10,
      },
      {
        query: {
          getNextPageParam: (lastPage: any) => {
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
      <div className="flex flex-col w-full max-w-[470px] mt-2 sm:mt-6 px-0 sm:px-0">
        {/* Stories Bar (placeholder) */}
        <div className="px-4 sm:px-0 mb-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-snet-purple to-snet-pink p-[2px]">
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-snet-purple/20 to-snet-pink/20 animate-pulse" />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  user_{i}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Feed Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-0 mb-4">
          <button
            onClick={() => setActiveTab('following')}
            className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all ${
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
            onClick={() => setActiveTab('foryou')}
            className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all ${
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
          ) : (
            <>
              {data.pages.every((page: any) => {
                const posts = Array.isArray(page)
                  ? page
                  : Array.isArray(page.data)
                    ? page.data
                    : Array.isArray(page.data?.data)
                      ? page.data.data
                      : [];
                return posts.length === 0;
              }) ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 animate-fade-in">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-snet-purple/10 to-snet-pink/10 flex items-center justify-center mb-4 animate-float">
                    <Compass className="w-10 h-10 text-snet-purple" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 font-heading">
                    Chào mừng bạn đến với SNet!
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Hãy theo dõi mọi người để thấy bài viết của họ trên bảng tin
                    của bạn.
                  </p>
                </div>
              ) : (
                <>
                  {data.pages.map((page: any, i) => {
                    const posts = Array.isArray(page)
                      ? page
                      : Array.isArray(page.data)
                        ? page.data
                        : Array.isArray(page.data?.data)
                          ? page.data.data
                          : [];
                    return (
                      <div key={i} className="flex flex-col">
                        {posts.map((post: any, index: number) => (
                          <div
                            key={post.id}
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <PostCard
                              post={{
                                id: post.id,
                                user: {
                                  id: post.user?.id || '',
                                  username: post.user?.username || 'User',
                                  avatarUrl:
                                    post.user?.avatar ||
                                    post.user?.profilePicture ||
                                    '',
                                },
                                createdAt:
                                  post.created_at ||
                                  post.createdAt ||
                                  new Date().toISOString(),
                                images: post.medias || post.mediaUrls || [],
                                caption: post.content || '',
                                likesCount:
                                  post.likesCount ||
                                  post.interactions?.likes ||
                                  0,
                                commentsCount:
                                  post.commentsCount ||
                                  post.interactions?.comments ||
                                  0,
                                repostsCount: post.interactions?.reposts || 0,
                                isLiked:
                                  post.isLiked ||
                                  post.interactions?.is_liked ||
                                  false,
                                isSaved: post.isSaved || false,
                                isReposted:
                                  post.interactions?.is_reposted || false,
                                repostedBy:
                                  post.reposted_by ||
                                  (post.shared_post
                                    ? [
                                        {
                                          id: post.user?.id,
                                          username: post.user?.username,
                                        },
                                      ]
                                    : undefined),
                                shared_post: post.shared_post
                                  ? {
                                      id: post.shared_post.id,
                                      user: {
                                        id: post.shared_post.user?.id || '',
                                        username:
                                          post.shared_post.user?.username ||
                                          'User',
                                        avatarUrl:
                                          post.shared_post.user?.avatar ||
                                          post.shared_post.user
                                            ?.profilePicture ||
                                          '',
                                      },
                                      createdAt:
                                        post.shared_post.created_at ||
                                        post.shared_post.createdAt ||
                                        new Date().toISOString(),
                                      images:
                                        post.shared_post.medias ||
                                        post.shared_post.mediaUrls ||
                                        [],
                                      caption: post.shared_post.content || '',
                                    }
                                  : undefined,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Load more spinner */}
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
                    {!hasNextPage &&
                      !isFetchingNextPage &&
                      (data?.pages?.[0] as any)?.data?.length > 0 && (
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
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar Area (Only visible on lg+ screens) */}
      <div className="hidden lg:block ml-16 w-[320px]">
        <SidebarRight />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
