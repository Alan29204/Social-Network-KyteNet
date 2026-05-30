import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Smile } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface PostResponse {
  id: string;
  user: {
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
}

interface PostDetailModalProps {
  post: PostResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDetailModal({ post, open, onOpenChange }: PostDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] h-[85vh] p-0 flex flex-row overflow-hidden bg-card border-none rounded-xl gap-0">
        
        {/* Left Side: Media */}
        <div className="w-[55%] h-full bg-black flex items-center justify-center border-r border-border">
          {post.images.length > 1 ? (
            <Carousel className="w-full h-full flex items-center justify-center">
              <CarouselContent>
                {post.images.map((img, index) => (
                  <CarouselItem key={index} className="flex items-center justify-center">
                    <img
                      src={img}
                      alt={`Post image ${index + 1}`}
                      className="w-full h-auto max-h-full object-contain"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4 opacity-50 hover:opacity-100 hidden sm:flex bg-background/50 border-none" />
              <CarouselNext className="right-4 opacity-50 hover:opacity-100 hidden sm:flex bg-background/50 border-none" />
            </Carousel>
          ) : (
            <img
              src={post.images[0]}
              alt="Post image"
              className="w-full h-auto max-h-full object-contain"
            />
          )}
        </div>

        {/* Right Side: Details & Comments */}
        <div className="w-[45%] h-full flex flex-col bg-background">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8 cursor-pointer ring-1 ring-border">
                <AvatarImage src={post.user.avatarUrl} alt={post.user.username} />
                <AvatarFallback>{post.user.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold text-sm cursor-pointer hover:text-muted-foreground transition-colors">
                  {post.user.username}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>

          {/* Comments List (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {/* Caption */}
            {post.caption && (
              <div className="flex gap-3 mb-6">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={post.user.avatarUrl} alt={post.user.username} />
                  <AvatarFallback>{post.user.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <div>
                    <span className="font-semibold text-sm mr-2">{post.user.username}</span>
                    <span className="text-sm whitespace-pre-wrap">{post.caption}</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(post.createdAt || new Date()), { addSuffix: true, locale: vi })}
                  </span>
                </div>
              </div>
            )}

            {/* Mock Comments */}
            <div className="flex flex-col gap-5">
              <div className="flex gap-3">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 flex-1">
                  <div>
                    <span className="font-semibold text-sm mr-2">nguoidung123</span>
                    <span className="text-sm">Bức ảnh thật tuyệt vời! Cảm ơn bạn đã chia sẻ nhé. 😍</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-semibold">
                    <span>2 giờ trước</span>
                    <button className="hover:text-foreground">15 lượt thích</button>
                    <button className="hover:text-foreground">Trả lời</button>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 mt-1 text-muted-foreground self-start">
                  <Heart className="w-3 h-3" />
                </Button>
              </div>

              <div className="flex gap-3">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback>A</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 flex-1">
                  <div>
                    <span className="font-semibold text-sm mr-2">another_user</span>
                    <span className="text-sm">Góc chụp rất đẹp!</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-semibold">
                    <span>5 giờ trước</span>
                    <button className="hover:text-foreground">Trả lời</button>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 mt-1 text-muted-foreground self-start">
                  <Heart className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex justify-center mt-6">
              <span className="text-xs text-muted-foreground">API lấy bình luận chưa được tích hợp...</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="hover:text-muted-foreground transition-colors">
                  <Heart className={`w-6 h-6 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
                <button className="hover:text-muted-foreground transition-colors">
                  <MessageCircle className="w-6 h-6" />
                </button>
                <button className="hover:text-muted-foreground transition-colors">
                  <Send className="w-6 h-6" />
                </button>
              </div>
              <button className="hover:text-muted-foreground transition-colors">
                <Bookmark className={`w-6 h-6 ${post.isSaved ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sm">{post.likesCount || 0} lượt thích</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {formatDistanceToNow(new Date(post.createdAt || new Date()), { addSuffix: true, locale: vi })}
              </span>
            </div>
          </div>

          {/* Add Comment Input */}
          <div className="p-4 border-t border-border flex items-center gap-3">
            <button className="text-muted-foreground hover:text-foreground">
              <Smile className="w-6 h-6" />
            </button>
            <input 
              type="text" 
              placeholder="Thêm bình luận..." 
              className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-muted-foreground"
            />
            <button className="text-primary font-semibold text-sm disabled:opacity-50" disabled>
              Đăng
            </button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
