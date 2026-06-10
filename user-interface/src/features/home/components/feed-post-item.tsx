import { PostCard } from '@/features/home/components/post-card';

/**
 * Chuẩn hóa dữ liệu post (raw từ API) sang props của PostCard.
 * Dùng chung cho cả 3 feed: following / foryou / recommended.
 */
export function FeedPostItem({ post }: { post: any }) {
  return (
    <PostCard
      post={{
        id: post.id,
        user: {
          id: post.user?.id || '',
          username: post.user?.username || 'User',
          avatarUrl: post.user?.avatar || post.user?.profilePicture || '',
        },
        createdAt:
          post.created_at || post.createdAt || new Date().toISOString(),
        images: post.medias || post.mediaUrls || [],
        caption: post.content || '',
        likesCount: post.likesCount || post.interactions?.likes || 0,
        commentsCount: post.commentsCount || post.interactions?.comments || 0,
        repostsCount: post.interactions?.reposts || 0,
        isLiked: post.isLiked || post.interactions?.is_liked || false,
        isSaved: post.isSaved || false,
        isReposted: post.interactions?.is_reposted || false,
        repostedBy:
          post.reposted_by ||
          (post.shared_post
            ? [{ id: post.user?.id, username: post.user?.username }]
            : undefined),
        shared_post: post.shared_post
          ? {
              id: post.shared_post.id,
              user: {
                id: post.shared_post.user?.id || '',
                username: post.shared_post.user?.username || 'User',
                avatarUrl:
                  post.shared_post.user?.avatar ||
                  post.shared_post.user?.profilePicture ||
                  '',
              },
              createdAt:
                post.shared_post.created_at ||
                post.shared_post.createdAt ||
                new Date().toISOString(),
              images:
                post.shared_post.medias || post.shared_post.mediaUrls || [],
              caption: post.shared_post.content || '',
            }
          : undefined,
      }}
    />
  );
}
