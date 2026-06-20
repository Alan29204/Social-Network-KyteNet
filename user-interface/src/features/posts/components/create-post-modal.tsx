import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePostsControllerCreate, searchControllerSearchUsers } from '@/services/apis/gen/queries';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { MentionsInput, Mention, SuggestionDataItem } from 'react-mentions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Paperclip, X, Globe, Users, Lock, Loader2, Smile, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  getMutationPost,
  getPostAuthorId,
  invalidatePostSurfaces,
  upsertPostInLists,
} from '@/features/posts/utils/post-cache';

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
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [postStatus, setPostStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (postStatus === 'loading') {
        e.preventDefault();
        e.returnValue = ''; // Required for some browsers to show prompt
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [postStatus]);

  useEffect(() => {
    if (!open) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (postStatus !== 'success') {
         setPostStatus('idle');
         setErrorMessage('');
      }
    }
  }, [open, postStatus]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setCaption((prev) => prev + emojiData.emoji);
  };

  const fetchUsers = async (query: string, callback: (data: SuggestionDataItem[]) => void) => {
    if (!query) return;
    try {
      const res = await searchControllerSearchUsers({ q: query, page: 1, limit: 10 });
      const suggestions = (res as any).data?.data?.map((u: any) => ({
        id: u.id,
        display: getDisplayName(u),
        avatar: u.avatar,
      })) || [];
      callback(suggestions);
    } catch (error) {
      console.error('Error fetching users:', error);
      callback([]);
    }
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
      onSuccess: async (response: any) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setPostStatus('success');

        const createdPost = getMutationPost(response);
        if (createdPost && user?.id) {
          upsertPostInLists(queryClient, createdPost, { userId: user.id });
        }

        await invalidatePostSurfaces(queryClient, {
          userId: user?.id || getPostAuthorId(createdPost),
          postId: createdPost?.id,
          includeSearch: true,
        });

        setTimeout(() => {
          // Reset state after success
          setImages([]);
          setMediaPreviews([]);
          setCaption('');
          setPrivacy('public');
          setPostStatus('idle');
          onOpenChange(false);
          
          if (user?.id) {
            navigate(`/profile/${user.id}`);
          }
        }, 1500);
      },
      onError: (error: any) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setPostStatus('error');
        
        console.error('Lỗi khi tạo bài viết:', error);
        if (error.response) {
          console.error('Response data:', error.response.data);
          setErrorMessage(error.response.data?.message || `Lỗi: ${JSON.stringify(error.response.data)}`);
        } else {
          setErrorMessage('Đăng bài thất bại. Vui lòng kiểm tra lại kết nối Internet.');
        }
      }
    }
  });

  const handleCreatePost = () => {
    if (!caption.trim() && images.length === 0) return;

    const hashtags = caption.match(/#[\p{L}0-9_]+/gu)?.map(tag => tag.slice(1)) || [];

    // Extract tagged users from the caption formatted by react-mentions: @[Display](id)
    const taggedUserIds: string[] = [];
    const mentionRegex = /@\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = mentionRegex.exec(caption)) !== null) {
      taggedUserIds.push(match[1]);
    }

    setPostStatus('loading');
    
    timeoutRef.current = setTimeout(() => {
      setPostStatus('error');
      setErrorMessage('Đăng bài thất bại. Vui lòng kiểm tra lại kết nối Internet.');
    }, 15000);

    createPost({
      data: {
        content: caption,
        privacy: privacy as any,
        'medias-posts': images,
        hashtags,
        tagged_users: taggedUserIds,
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (postStatus === 'loading' || postStatus === 'success') return;
      onOpenChange(val);
    }}>
      <DialogContent 
        className={`sm:max-w-[500px] p-0 overflow-hidden gap-0 bg-card ${postStatus === 'loading' || postStatus === 'success' ? '[&>button]:hidden' : ''}`}
        onInteractOutside={(e) => {
          if (postStatus === 'loading' || postStatus === 'success') e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (postStatus === 'loading' || postStatus === 'success') e.preventDefault();
        }}
      >
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="w-8" /> {/* Spacer to center title */}
          <DialogTitle className="text-center text-base font-semibold">
            Tạo bài viết mới
          </DialogTitle>
          {postStatus === 'idle' || postStatus === 'error' ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary font-semibold text-sm hover:text-primary/80 hover:bg-transparent px-0"
              onClick={handleCreatePost}
              disabled={(!caption.trim() && images.length === 0) || isPending}
            >
              Chia sẻ
            </Button>
          ) : (
            <div className="w-8" />
          )}
        </DialogHeader>

        {postStatus === 'loading' && (
          <div className="flex flex-col items-center justify-center h-[300px] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-lg font-semibold animate-pulse">Đang đăng bài...</p>
          </div>
        )}

        {postStatus === 'success' && (
          <div className="flex flex-col items-center justify-center h-[300px] gap-4">
            <div className="relative">
              <CheckCircle2 className="w-16 h-16 text-green-500 animate-checkmark stroke-[1.5]" />
            </div>
            <p className="text-lg font-semibold text-green-600">Đăng bài thành công!</p>
          </div>
        )}

        {postStatus === 'error' && (
          <div className="flex flex-col items-center justify-center h-[300px] gap-4 px-6 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive" />
            <p className="text-lg font-semibold text-destructive">{errorMessage}</p>
            <Button variant="outline" onClick={() => setPostStatus('idle')}>Quay lại</Button>
          </div>
        )}

        {postStatus === 'idle' && (
          <div className="flex flex-col h-full max-h-[70vh] overflow-y-auto">
          {/* User Info & Privacy */}
          <div className="flex items-center gap-3 p-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src={getAvatarUrl(user?.avatar)} className="object-cover" />
              <AvatarFallback className="bg-muted" />
            </Avatar>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sm">{getDisplayName(user)}</span>
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
                  <SelectItem value="follower">
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3" /> Người theo dõi
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
            <div className="mentions-input-wrapper relative border-none">
              <MentionsInput
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Bạn đang nghĩ gì?"
                className="mentions-input min-h-[100px] border-none focus-visible:ring-0 resize-none px-0 text-base shadow-none bg-transparent w-full"
                style={{
                  control: { fontSize: '1rem', fontWeight: 'normal', outline: 'none', border: 'none' },
                  highlighter: { padding: 0, border: 'none' },
                  input: { margin: 0, padding: 0, border: 'none', outline: 'none' },
                  suggestions: {
                    list: {
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.375rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 50,
                      marginTop: '24px'
                    },
                    item: {
                      padding: '8px 12px',
                      borderBottom: '1px solid hsl(var(--border))',
                    },
                  },
                }}
              >
                <Mention
                  trigger="@"
                  data={fetchUsers}
                  displayTransform={(_id, display) => display}
                  renderSuggestion={(suggestion, _search, _highlightedDisplay, _index, focused) => (
                    <div className={`flex items-center gap-2 ${focused ? 'bg-muted rounded-sm' : ''} p-1 cursor-pointer hover:bg-muted`}>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={getAvatarUrl((suggestion as any).avatar)} className="object-cover" />
                        <AvatarFallback className="bg-muted" />
                      </Avatar>
                      <span className="text-sm font-medium">{suggestion.display}</span>
                    </div>
                  )}
                  style={{
                    color: '#3b82f6',
                    position: 'relative',
                    zIndex: 1
                  }}
                />
              </MentionsInput>
            </div>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
