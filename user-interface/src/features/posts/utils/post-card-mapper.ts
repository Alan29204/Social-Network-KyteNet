const VIDEO_PATTERN = /\.(mp4|mov|webm|ogg|m4v|mkv)($|\?)/i;
const IMAGE_PATTERN = /\.(jpg|jpeg|png|webp|gif)($|\?)/i;

export const normalizePostMediaUrl = (url?: string) => {
  if (!url) return '';
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }

  const base = import.meta.env.VITE_MEDIA_URL || 'http://localhost:3000';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const isVideoPostMedia = (url?: string) =>
  !!url && (VIDEO_PATTERN.test(url) || url.includes('video'));

export const isImagePostMedia = (url?: string) =>
  !!url &&
  (IMAGE_PATTERN.test(url) ||
    (!isVideoPostMedia(url) && !url.includes('video')));

const getPostMediaUrls = (post: any = {}) => {
  const medias = Array.isArray(post.medias)
    ? post.medias
    : Array.isArray(post.mediaUrls)
      ? post.mediaUrls
      : Array.isArray(post.images)
        ? post.images
        : [];

  return medias.filter(Boolean).map((url: string) => normalizePostMediaUrl(url));
};

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

export const mapApiPostToPostCard = (post: any = {}) => ({
  id: post.id,
  user: mapPostUser(post.user),
  user_id: post.user_id,
  privacy: post.privacy,
  createdAt: post.created_at || post.createdAt || new Date().toISOString(),
  created_at: post.created_at,
  images: getPostMediaUrls(post),
  medias: getPostMediaUrls(post),
  caption: post.content || post.caption || '',
  content: post.content,
  likesCount: post.likesCount || post.interactions?.likes || 0,
  commentsCount: post.commentsCount || post.interactions?.comments || 0,
  repostsCount: post.repostsCount || post.interactions?.reposts || 0,
  tagged_users: post.tagged_users || [],
  hashtags: post.hashtags || [],
  isLiked: post.isLiked || post.interactions?.is_liked || false,
  isSaved: post.isSaved || post.interactions?.is_saved || false,
  isReposted: post.isReposted || post.interactions?.is_reposted || false,
  interactions: post.interactions,
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
        user_id: post.shared_post.user_id,
        privacy: post.shared_post.privacy,
        createdAt:
          post.shared_post.created_at ||
          post.shared_post.createdAt ||
          new Date().toISOString(),
        created_at: post.shared_post.created_at,
        images: getPostMediaUrls(post.shared_post),
        medias: getPostMediaUrls(post.shared_post),
        caption: post.shared_post.content || post.shared_post.caption || '',
        content: post.shared_post.content,
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
        interactions: post.shared_post.interactions || post.interactions,
      }
    : undefined,
});
