import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Repeat, Check } from 'lucide-react';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PostDetailModal } from '@/features/posts/components/post-detail-modal';
import { PostActionModal } from '@/features/posts/components/post-action-modal';
import { EditPostModal } from '@/features/posts/components/edit-post-modal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';

interface PostCardProps {
  post: {
    id: string;
    user: {
      id: string;
      username: string;
      avatarUrl?: string;
    };
    createdAt: string;
    images: string[];
    caption: string;
    likesCount: number;
    commentsCount: number;
    repostsCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    isReposted?: boolean;
    shared_post?: any;
  };
}

export function PostCard({ post }: PostCardProps) {
  const { user: currentUser } = useAuthStore();
  const isMyPost = currentUser?.id === post.user.id;

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Local state for debounced optimistic repost
  const [localReposted, setLocalReposted] = useState(post.isReposted);
  const [localRepostsCount, setLocalRepostsCount] = useState(post.repostsCount);
  const repostTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [localLiked, setLocalLiked] = useState(post.isLiked);
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount);

  useEffect(() => {
    setLocalReposted(post.isReposted);
    setLocalRepostsCount(post.repostsCount);
    setLocalLiked(post.isLiked);
    setLocalLikesCount(post.likesCount);
  }, [post.isReposted, post.repostsCount, post.isLiked, post.likesCount]);

  const queryClient = useQueryClient();

  const reactionMutation = useMutation({
    mutationFn: (data: { postId: string; reaction: string }) =>
      orvalClient({ url: '/reactions', method: 'POST', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
      queryClient.invalidateQueries({ queryKey: ['postDetail', post.id] });
    },
  });

  const handleLikePost = () => {
    const newStatus = !localLiked;
    setLocalLiked(newStatus);
    setLocalLikesCount((prev) => (newStatus ? (prev || 0) + 1 : Math.max(0, (prev || 1) - 1)));
    reactionMutation.mutate({ postId: post.id, reaction: 'like' });
  };

  const repostMutation = useMutation({
    mutationFn: () =>
      orvalClient({ url: '/posts/share', method: 'POST', data: { post_id: post.shared_post?.id || post.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-reposts'] });
    },
  });

  const handleRepost = () => {
    // Optimistic local update instantly
    const newStatus = !localReposted;
    setLocalReposted(newStatus);
    setLocalRepostsCount((prev) => (newStatus ? (prev || 0) + 1 : Math.max(0, (prev || 1) - 1)));

    if (repostTimerRef.current) clearTimeout(repostTimerRef.current);
    repostTimerRef.current = setTimeout(() => {
      if (newStatus !== post.isReposted) {
        repostMutation.mutate();
      }
    }, 500);
  };

  const displayPost = post.shared_post || post;
  const isRepost = !!post.shared_post;

  return (
    <article className="border-b border-border py-4 w-full max-w-[470px] mx-auto sm:border sm:rounded-xl sm:my-6 sm:bg-card">
      {/* Header */}
      {isRepost && (
        <div className="px-3 sm:px-4 pt-3 pb-1 flex items-center gap-2 text-muted-foreground">
          <Repeat className="w-4 h-4" />
          <span className="text-xs font-semibold">{post.user.username} đã đăng lại</span>
        </div>
      )}
      <div className="flex items-center justify-between px-3 pb-3 sm:px-4 pt-2">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${displayPost.user.id}`}>
            <Avatar className="w-10 h-10 cursor-pointer">
              <AvatarImage src={displayPost.user.avatarUrl || displayPost.user.avatar || displayPost.user.profilePicture || '/default-avatar.png'} alt={displayPost.user.username} className="object-cover" />
              <AvatarFallback>{displayPost.user.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex items-center gap-2">
            <Link to={`/profile/${displayPost.user.id}`}>
              <span className="font-semibold text-sm cursor-pointer hover:text-foreground/80">
                {displayPost.user.username}
              </span>
            </Link>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-muted-foreground text-sm font-normal">
              {formatTimeAgo(displayPost.createdAt || displayPost.created_at || new Date().toISOString())}
            </span>
          </div>
        </div>
          <Button variant="ghost" size="icon" onClick={() => setActionOpen(true)}>
            <MoreHorizontal className="w-5 h-5" />
          </Button>
      </div>

      {/* Caption (Text Content) */}
      {(displayPost.caption || displayPost.content) && (
        <div className="px-3 py-2 sm:px-4 text-sm whitespace-pre-wrap break-words">
          {displayPost.caption || displayPost.content}
        </div>
      )}

      {/* Media (Images/Videos) */}
      {displayPost.images && displayPost.images.length > 0 && (
        <div className="relative bg-black sm:bg-transparent w-full overflow-hidden border-t border-b border-border sm:border-none flex items-center justify-center">
          {displayPost.images.length > 1 ? (
            <Carousel className="w-full">
              <CarouselContent>
                {displayPost.images.map((img: string, index: number) => (
                  <CarouselItem key={index} className="flex items-center justify-center">
                    <img
                      src={img}
                      alt={`Post image ${index + 1}`}
                      className="w-full h-auto max-h-[700px] object-contain cursor-pointer"
                      onClick={() => setIsDetailOpen(true)}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4 opacity-50 hover:opacity-100 hidden sm:flex" />
              <CarouselNext className="right-4 opacity-50 hover:opacity-100 hidden sm:flex" />
            </Carousel>
          ) : (
            <img
              src={displayPost.images[0]}
              alt="Post image"
              className="w-full h-auto max-h-[700px] object-contain cursor-pointer"
              onClick={() => setIsDetailOpen(true)}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-3 pt-3 sm:px-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <button 
            className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors"
            onClick={handleLikePost}
          >
            <Heart
              className={`w-6 h-6 ${
                localLiked ? 'fill-red-500 text-red-500' : ''
              }`}
            />
            {localLikesCount > 0 && <span className="text-sm font-semibold">{localLikesCount}</span>}
          </button>

          <button 
            className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors"
            onClick={() => setIsDetailOpen(true)}
          >
            <MessageCircle className="w-6 h-6" />
            {post.commentsCount > 0 && <span className="text-sm font-semibold">{post.commentsCount}</span>}
          </button>

          <button 
            className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors disabled:opacity-50"
            onClick={handleRepost}
            disabled={repostMutation.isPending || isMyPost}
          >
            <div className="relative inline-flex items-center justify-center">
              <Repeat className={`w-6 h-6 ${localReposted ? 'text-green-500' : ''}`} />
              {localReposted && (
                <Check className="w-3 h-3 absolute text-green-500 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" strokeWidth={4} />
              )}
            </div>
            <span className={`text-sm font-medium ${localReposted ? 'text-green-500' : ''}`}>
              {localRepostsCount}
            </span>
          </button>

          <button className="hover:text-muted-foreground transition-colors">
            <Send className="w-6 h-6" />
          </button>
        </div>
        <button className="hover:opacity-60 transition-opacity">
          <Bookmark
            className={`w-6 h-6 ${
              post.isSaved ? 'fill-foreground text-foreground' : 'text-foreground'
            }`}
          />
        </button>
      </div>

      {/* Details */}
      <div className="px-3 py-2 sm:px-4 flex flex-col gap-1">


        {post.commentsCount > 0 && (
          <button className="text-muted-foreground text-sm text-left mt-1 hover:text-foreground/80">
            Xem tất cả {post.commentsCount} bình luận
          </button>
        )}
        
        {/* Quick Add Comment */}
        <div className="mt-2 hidden sm:flex items-center gap-2">
          <input 
            type="text" 
            placeholder="Thêm bình luận..." 
            className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-muted-foreground"
            onClick={() => setIsDetailOpen(true)}
            readOnly
          />
          <button className="text-primary font-semibold text-sm disabled:opacity-50" disabled>
            Đăng
          </button>
        </div>
      </div>

      {/* Post Detail Modal */}
      <PostDetailModal 
        post={post} 
        open={isDetailOpen} 
        onOpenChange={setIsDetailOpen} 
      />
      
      {actionOpen && (
        <PostActionModal
          post={post}
          open={actionOpen}
          onOpenChange={setActionOpen}
          onEditClick={() => setEditOpen(true)}
        />
      )}

      {editOpen && (
        <EditPostModal
          post={post}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </article>
  );
}
