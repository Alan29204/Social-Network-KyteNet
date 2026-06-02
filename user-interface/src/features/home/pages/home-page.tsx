import { SidebarRight } from '@/layouts/components/sidebar-right';

import { useInfiniteQuery } from '@tanstack/react-query';
import { postsControllerFindAll } from '@/services/apis/gen/queries';
import { PostCard } from '@/features/home/components/post-card';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['postsControllerFindAll'],
      queryFn: ({ pageParam = 1 }) =>
        postsControllerFindAll({
          page: pageParam,
          limit: 10,
          is_repost: false,
        } as any),
      getNextPageParam: (lastPage) => {
        // Assuming meta exists, fallback to undefined
        const meta = (lastPage as any).meta || (lastPage as any).data?.meta;
        if (meta && meta.hasNextPage) {
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

  return (
    <div className="flex justify-center w-full min-h-screen pb-20 sm:pb-0">
      {/* Center Feed Area */}
      <div className="flex flex-col w-full max-w-[470px] mt-8 px-0 sm:px-0">
        <div className="flex flex-col">
          {status === 'pending' ? (
            <div className="flex flex-col gap-6 px-4 sm:px-0">
              <div className="w-full h-[600px] border border-border rounded-lg bg-card animate-pulse"></div>
              <div className="w-full h-[600px] border border-border rounded-lg bg-card animate-pulse"></div>
            </div>
          ) : status === 'error' ? (
            <div className="text-center text-destructive p-4">
              Đã xảy ra lỗi khi tải bảng tin.
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
                    {posts.map((post: any) => (
                      <PostCard
                        key={post.id}
                        post={{
                          id: post.id,
                          user: {
                            id: post.user?.id || '',
                            username: post.user?.username || 'User',
                            avatarUrl: post.user?.avatar || post.user?.profilePicture || '',
                          },
                          createdAt:
                            post.created_at ||
                            post.createdAt ||
                            new Date().toISOString(),
                          images: post.medias || post.mediaUrls || [],
                          caption: post.content || '',
                          likesCount:
                            post.likesCount || post.interactions?.likes || 0,
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
                          isReposted: post.interactions?.is_reposted || false,
                          shared_post: post.shared_post
                            ? {
                                id: post.shared_post.id,
                                user: {
                                  id: post.shared_post.user?.id || '',
                                  username:
                                    post.shared_post.user?.username || 'User',
                                  avatarUrl:
                                    post.shared_post.user?.avatar || post.shared_post.user?.profilePicture || '',
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
      <div className="hidden lg:block ml-16 w-[320px]">
        <SidebarRight />
      </div>
    </div>
  );
}
