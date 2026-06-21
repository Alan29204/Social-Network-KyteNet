const mapPostUser = (user: any = {}) => ({
  id: user?.id || '',
  username: user?.username || 'User',
  full_name: user?.full_name,
  avatarUrl: user?.avatar || user?.avatarUrl || user?.profilePicture || '',
  avatar: user?.avatar,
  profilePicture: user?.profilePicture,
  privacy: user?.privacy,
  isFollowing: user?.isFollowing ?? user?.is_following,
  relationStatus: user?.relationStatus ?? user?.relation_status,
});

export const mapApiPostToPostCard = (post: any) => ({
  id: post.id,
  user: mapPostUser(post.user),
  createdAt: post.created_at || post.createdAt || new Date().toISOString(),
  images: post.medias || post.mediaUrls || [],
  caption: post.content || post.caption || '',
  likesCount: post.likesCount || post.interactions?.likes || 0,
  commentsCount: post.commentsCount || post.interactions?.comments || 0,
  repostsCount: post.repostsCount || post.interactions?.reposts || 0,
  tagged_users: post.tagged_users || [],
  hashtags: post.hashtags || [],
  isLiked: post.isLiked || post.interactions?.is_liked || false,
  isSaved: post.isSaved || post.interactions?.is_saved || false,
  isReposted: post.isReposted || post.interactions?.is_reposted || false,
  repostedBy:
    post.reposted_by ||
    (post.shared_post
      ? [
          {
            id: post.user?.id,
            username: post.user?.username,
            full_name: post.user?.full_name,
          },
        ]
      : undefined),
  shared_post: post.shared_post
    ? {
        id: post.shared_post.id,
        user: mapPostUser(post.shared_post.user),
        createdAt:
          post.shared_post.created_at ||
          post.shared_post.createdAt ||
          new Date().toISOString(),
        images: post.shared_post.medias || post.shared_post.mediaUrls || [],
        caption: post.shared_post.content || post.shared_post.caption || '',
        likesCount:
          post.shared_post.likesCount ||
          post.shared_post.interactions?.likes ||
          post.interactions?.likes ||
          0,
        commentsCount:
          post.shared_post.commentsCount ||
          post.shared_post.interactions?.comments ||
          post.interactions?.comments ||
          0,
        repostsCount:
          post.shared_post.repostsCount ||
          post.shared_post.interactions?.reposts ||
          post.interactions?.reposts ||
          0,
        isLiked:
          post.shared_post.isLiked ||
          post.shared_post.interactions?.is_liked ||
          post.interactions?.is_liked ||
          false,
        isSaved:
          post.shared_post.isSaved ||
          post.shared_post.interactions?.is_saved ||
          post.interactions?.is_saved ||
          false,
        isReposted:
          post.shared_post.isReposted ||
          post.shared_post.interactions?.is_reposted ||
          post.interactions?.is_reposted ||
          false,
        tagged_users: post.shared_post.tagged_users || [],
        hashtags: post.shared_post.hashtags || [],
        content: post.shared_post.content,
        created_at: post.shared_post.created_at,
      }
    : undefined,
});
