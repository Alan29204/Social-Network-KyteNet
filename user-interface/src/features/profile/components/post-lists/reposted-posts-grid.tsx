import { useQuery } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { PostCard } from '@/features/home/components/post-card';
import { Loader2 } from 'lucide-react';

export function RepostedPostsGrid({ userId }: { userId: string }) {
  const { data: res, isLoading } = useQuery({
    queryKey: ['profile-reposts', userId],
    queryFn: () => orvalClient<any>({ url: `/posts?user_id=${userId}&is_repost=true`, method: 'GET' }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground w-8 h-8" /></div>;
  }

  const posts = res?.data?.data || res?.data || [];

  if (posts.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8 border rounded-lg mt-4 max-w-xl mx-auto">
        Chưa có bài đăng lại nào
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-4">
      {posts.map((post: any) => (
        <PostCard 
          key={post.id} 
          post={{
            id: post.id,
            user: {
              id: post.user?.id || '',
              username: post.user?.username || 'User',
              avatarUrl: post.user?.avatar || post.user?.profilePicture || post.user?.avatarUrl || '',
            },
            createdAt: post.created_at || post.createdAt || new Date().toISOString(),
            images: post.medias || post.mediaUrls || [],
            caption: post.content || '',
            likesCount: post.likesCount || post.interactions?.likes || 0,
            commentsCount: post.commentsCount || post.interactions?.comments || 0,
            repostsCount: post.interactions?.reposts || 0,
            isLiked: post.isLiked || post.interactions?.is_liked || false,
            isSaved: post.isSaved || false,
            isReposted: post.interactions?.is_reposted || false,
            shared_post: post.shared_post ? {
              id: post.shared_post.id,
              user: {
                id: post.shared_post.user?.id || '',
                username: post.shared_post.user?.username || 'User',
                avatarUrl: post.shared_post.user?.avatar || post.shared_post.user?.profilePicture || post.shared_post.user?.avatarUrl || '',
              },
              createdAt: post.shared_post.created_at || post.shared_post.createdAt || new Date().toISOString(),
              images: post.shared_post.medias || post.shared_post.mediaUrls || [],
              caption: post.shared_post.content || '',
            } : undefined,
          }} 
        />
      ))}
    </div>
  );
}
