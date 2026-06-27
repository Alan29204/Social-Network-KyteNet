import { PostCard } from '@/features/home/components/post-card';
import { mapApiPostToPostCard } from '@/features/home/utils/post-card-mapper';

/**
 * Chuẩn hóa dữ liệu post (raw từ API) sang props của PostCard.
 * Dùng chung cho cả 3 feed: following / explore / recommended.
 */
export function FeedPostItem({ post }: { post: any }) {
  return <PostCard post={mapApiPostToPostCard(post)} showFollowButton />;
}
