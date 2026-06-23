import {
  isImagePostMedia,
  isVideoPostMedia,
  mapApiPostToPostCard,
  normalizePostMediaUrl,
} from '@/features/posts/utils/post-card-mapper';

export const normalizeMediaUrl = normalizePostMediaUrl;

export const isImageMedia = isImagePostMedia;

export const isVideoMedia = isVideoPostMedia;

export const getPostMedias = (post: any) =>
  Array.isArray(post?.medias)
    ? post.medias
    : Array.isArray(post?.mediaUrls)
      ? post.mediaUrls
      : [];

export const getMediaThumbnail = (
  post: any,
  mediaType: 'image' | 'video',
) => {
  const medias = getPostMedias(post);
  const matched = medias.find((media: string) =>
    mediaType === 'video' ? isVideoMedia(media) : isImageMedia(media),
  );
  return normalizeMediaUrl(matched || medias[0]);
};

export const mapMediaPostToDetailPost = mapApiPostToPostCard;
