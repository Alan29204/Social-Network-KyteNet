import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePostsControllerCreate } from '@/services/apis/gen/queries';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Paperclip, X, Globe, Users, Lock, Loader2, Smile } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // TODO: Add current user info prop or fetch from store
}

export function CreatePostModal({ open, onOpenChange }: CreatePostModalProps) {
  const [images, setImages] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<{url: string, type: string}[]>([]);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setCaption((prev) => prev + emojiData.emoji);
  };

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      mediaPreviews.forEach((m) => URL.revokeObjectURL(m.url));
    };
  }, [mediaPreviews]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setImages((prev) => [...prev, ...newFiles]);
      
      const newPreviews = newFiles.map((file) => ({
        url: URL.createObjectURL(file),
        type: file.type
      }));
      setMediaPreviews((prev) => [...prev, ...newPreviews]);
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
    setMediaPreviews((prev) => {
      const itemToRemove = prev[indexToRemove];
      if (itemToRemove) URL.revokeObjectURL(itemToRemove.url); // Clean up
      return prev.filter((_, index) => index !== indexToRemove);
    });
  };

  const { mutate: createPost, isPending } = usePostsControllerCreate({
    mutation: {
      onSuccess: () => {
        // Reset state after success
        setImages([]);
        setMediaPreviews([]);
        setCaption('');
        setPrivacy('public');
        onOpenChange(false);
        // Refresh feed
        queryClient.invalidateQueries({ queryKey: ['postsControllerFindAll'] });
      },
      onError: (error: any) => {
        console.error('Lỗi khi tạo bài viết:', error);
        if (error.response) {
          console.error('Response data:', error.response.data);
          alert(`Lỗi: ${JSON.stringify(error.response.data)}`);
        } else {
          alert('Có lỗi xảy ra, vui lòng thử lại.');
        }
      }
    }
  });

  const handleCreatePost = () => {
    if (!caption.trim() && images.length === 0) return;

    const hashtags = caption.match(/#[\p{L}0-9_]+/gu)?.map(tag => tag.slice(1)) || [];

    createPost({
      data: {
        content: caption,
        privacy: privacy as any,
        'medias-posts': images,
        hashtags,
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0 bg-card">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="w-8" /> {/* Spacer to center title */}
          <DialogTitle className="text-center text-base font-semibold">
            Tạo bài viết mới
          </DialogTitle>
            <Button
            variant="ghost"
            size="sm"
            className="text-primary font-semibold text-sm hover:text-primary/80 hover:bg-transparent px-0"
            onClick={handleCreatePost}
            disabled={(!caption.trim() && images.length === 0) || isPending}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Chia sẻ'}
          </Button>
        </DialogHeader>

        <div className="flex flex-col h-full max-h-[70vh] overflow-y-auto">
          {/* User Info & Privacy */}
          <div className="flex items-center gap-3 p-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.avatar || '/default-avatar.png'} className="object-cover" />
              <AvatarFallback>{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sm">{user?.username || 'Người dùng hiện tại'}</span>
              <Select value={privacy} onValueChange={setPrivacy}>
                <SelectTrigger className="h-6 text-xs px-2 border-border focus:ring-0 gap-1 bg-secondary w-fit rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3" /> Công khai
                    </div>
                  </SelectItem>
                  <SelectItem value="friend">
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3" /> Bạn bè
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3" /> Chỉ mình tôi
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Caption Input */}
          <div className="px-4 pb-2">
            <Textarea
              placeholder="Bạn đang nghĩ gì?"
              className="min-h-[100px] border-none focus-visible:ring-0 resize-none px-0 text-base shadow-none bg-transparent"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          {/* Image/Video Previews & Upload Box */}
          <div className="p-4 pt-0">
            {mediaPreviews.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {mediaPreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-md overflow-hidden group border border-border bg-black/5">
                    {preview.type.startsWith('video/') ? (
                      <video
                        src={preview.url}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={preview.url}
                        alt={`Preview ${index}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 p-3 border border-border rounded-lg mt-2">
              <span className="text-sm font-semibold flex-1">Thêm vào bài viết</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Smile className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-none" align="end" side="top">
                  <EmojiPicker 
                    onEmojiClick={handleEmojiClick}
                    width={320}
                    height={400}
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted text-green-500 hover:text-green-600"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-5 h-5" />
              </Button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={handleImageChange}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
