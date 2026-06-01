import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PostDetailModal } from '@/features/posts/components/post-detail-modal';

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
    isLiked?: boolean;
    isSaved?: boolean;
  };
}

export function PostCard({ post }: PostCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  return (
    <article className="border-b border-border py-4 w-full max-w-[470px] mx-auto sm:border sm:rounded-xl sm:my-6 sm:bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pb-3 sm:px-4">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.user.id}`}>
            <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-background ring-offset-2 ring-offset-primary">
              <AvatarImage src={post.user.avatarUrl || '/default-avatar.png'} alt={post.user.username} className="object-cover" />
              <AvatarFallback>{post.user.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex items-center gap-2">
            <Link to={`/profile/${post.user.id}`}>
              <span className="font-semibold text-sm cursor-pointer hover:text-foreground/80">
                {post.user.username}
              </span>
            </Link>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(post.createdAt), {
                addSuffix: true,
                locale: vi,
              })}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      </div>

      {/* Media */}
      {post.images.length > 0 && (
        <div className="relative bg-black sm:bg-transparent w-full overflow-hidden border-t border-b border-border sm:border-none flex items-center justify-center">
          {post.images.length > 1 ? (
            <Carousel className="w-full">
              <CarouselContent>
                {post.images.map((img, index) => (
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
              src={post.images[0]}
              alt="Post image"
              className="w-full h-auto max-h-[700px] object-contain cursor-pointer"
              onClick={() => setIsDetailOpen(true)}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-3 pt-3 sm:px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="hover:text-muted-foreground transition-colors hover:bg-transparent">
            <Heart className={`w-6 h-6 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="hover:text-muted-foreground transition-colors hover:bg-transparent"
            onClick={() => setIsDetailOpen(true)}
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="icon" className="hover:text-muted-foreground transition-colors hover:bg-transparent">
            <Send className="w-6 h-6 text-foreground" />
          </Button>
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
        <span className="font-semibold text-sm">
          {post.likesCount.toLocaleString()} lượt thích
        </span>

        <div className="text-sm">
          <Link to={`/profile/${post.user.id}`}>
            <span className="font-semibold cursor-pointer hover:text-foreground/80 mr-2">
              {post.user.username}
            </span>
          </Link>
          <span className="whitespace-pre-wrap break-words">{post.caption}</span>
        </div>

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
    </article>
  );
}
