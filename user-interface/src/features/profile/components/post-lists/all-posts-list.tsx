import { useQuery } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { PostCard } from '@/features/home/components/post-card';
import { Skeleton } from '@/components/ui/skeleton';
import { mapApiPostToPostCard } from '@/features/posts/utils/post-card-mapper';

export function AllPostsList({ userId }: { userId: string }) {
  const {
    data: res,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['profile-posts', userId],
    queryFn: () =>
      orvalClient<any>({
        url: `/posts?user_id=${userId}&is_repost=false&page=1&limit=10`,
        method: 'GET',
      }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-xl mx-auto py-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 p-4 border rounded-xl animate-in fade-in duration-500"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[120px]" />
              </div>
            </div>
            <Skeleton className="w-full h-[400px] rounded-xl" />
            <div className="flex gap-4">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-destructive p-8 border rounded-lg">
        Lỗi khi tải bài viết
      </div>
    );
  }

  const posts = res?.data?.data || res?.data || [];

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-4">
      {posts.length === 0 ? (
        <div className="text-center text-muted-foreground p-8 border rounded-lg">
          Chưa có bài viết nào
        </div>
      ) : (
        posts.map((post: any) => (
          <PostCard
            key={post.id}
            post={mapApiPostToPostCard(post)}
            videoClickMode="reels"
            videoReelsUserId={userId}
          />
        ))
      )}
    </div>
  );
}
