import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Lock, FileX2 } from 'lucide-react';
import { PostDetailModal } from '@/features/posts/components/post-detail-modal';
import { PostContentRenderer } from '@/features/posts/components/post-content-renderer';
import { useState } from 'react';

interface MessagePostCardProps {
  post: any; // Can be null if deleted, or { is_unavailable: true } if privacy restricted
}

export function MessagePostCard({ post }: MessagePostCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  if (!post) {
    // Post was deleted completely
    return (
      <div className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 text-center w-full max-w-[250px] bg-muted text-muted-foreground`}>
        <FileX2 className="w-8 h-8 opacity-50" />
        <span className="text-sm font-medium">Bài viết không khả dụng hoặc đã bị xóa</span>
      </div>
    );
  }

  if (post.is_unavailable) {
    // Post is restricted by privacy
    let reasonText = "Bài viết không khả dụng.";
    if (post.unavailable_reason === 'blocked') {
      reasonText = "Bạn không thể xem bài viết này do cài đặt quyền riêng tư.";
    } else if (post.unavailable_reason === 'private' || post.unavailable_reason === 'follower') {
      reasonText = "Bài viết không khả dụng. Tài khoản của người này là riêng tư và bạn không theo dõi họ.";
    }

    return (
      <div className={`p-4 rounded-xl flex flex-col items-center justify-center gap-3 text-center w-full max-w-[250px] bg-muted text-muted-foreground`}>
        <div className="w-12 h-12 rounded-full bg-background/50 flex items-center justify-center">
          <Lock className="w-6 h-6 opacity-70" />
        </div>
        <span className="text-sm font-medium leading-snug">{reasonText}</span>
      </div>
    );
  }

  // Normal Post Card
  const thumbnailUrl = post.medias?.[0];
  const isVideo = thumbnailUrl?.match(/\.(mp4|webm|mov|mkv)$/i) || thumbnailUrl?.includes('video');

  return (
    <>
      <div 
        className={`w-full max-w-[250px] rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] border bg-muted border-border text-foreground`}
        onClick={() => setIsDetailOpen(true)}
      >
        {/* Header */}
        <div className="p-3 flex items-center gap-2 border-b border-border/10">
          <Avatar className="w-6 h-6">
            <AvatarImage src={post.user?.avatarUrl || post.user?.avatar || '/default-avatar.png'} />
            <AvatarFallback>{post.user?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-xs truncate">{post.user?.username}</span>
        </div>

        {/* Thumbnail */}
        {thumbnailUrl && (
          <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
            {isVideo ? (
              <video src={thumbnailUrl} className="w-full h-full object-cover opacity-90" />
            ) : (
              <img src={thumbnailUrl} alt="Post thumbnail" className="w-full h-full object-cover" />
            )}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                </div>
              </div>
            )}
            {post.medias?.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/60 p-1 rounded">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Caption Preview */}
        {(post.content || post.caption) && (
          <div className="p-3">
            <div className="text-xs line-clamp-2 opacity-90">
              <PostContentRenderer 
                content={post.content || post.caption} 
                taggedUsers={post.tagged_users} 
              />
            </div>
          </div>
        )}
      </div>

      <PostDetailModal 
        post={{ ...post, images: post.medias, createdAt: post.created_at, likesCount: post.reactions?.length || 0, commentsCount: post.comments?.length || 0 }} 
        open={isDetailOpen} 
        onOpenChange={setIsDetailOpen} 
      />
    </>
  );
}
