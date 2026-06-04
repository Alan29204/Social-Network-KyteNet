import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useUsersControllerSearchUsersForMessage, useChatRoomsControllerGetOrCreateDirectChat, useChatMessagesControllerCreateMessage } from '@/services/apis/gen/queries';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { socketService } from '@/services/socket.service';

interface SharePostModalProps {
  post: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SharePostModal({ post, open, onOpenChange }: SharePostModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const { data: usersResponse, isLoading } = useUsersControllerSearchUsersForMessage(
    { q: searchTerm },
    { query: { enabled: open } }
  );
  
  const users: any[] = (usersResponse as any)?.data?.data || [];

  const createDirectChatMutation = useChatRoomsControllerGetOrCreateDirectChat();
  const createMessageMutation = useChatMessagesControllerCreateMessage();

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSend = async () => {
    if (selectedUserIds.length === 0) return;
    setIsSending(true);

    try {
      for (const targetUserId of selectedUserIds) {
        // 1. Get or create chat room
        const roomRes: any = await createDirectChatMutation.mutateAsync({
          targetUserId,
        });
        const roomId = roomRes?.data?.room_id || roomRes?.room_id;

        if (!roomId) throw new Error('Không thể tạo phòng chat');

        // 2. Send the Post Card message via WebSocket to guarantee shared_post_id transmission
        const socket = socketService.getSocket();
        if (socket?.connected) {
          // Emit post card
          socket.emit('sendMessage', {
            chat_room_id: roomId,
            shared_post_id: post.id,
            tempId: 'temp-' + Date.now(),
          });
          
          // Emit optional text message (if any)
          if (messageText.trim()) {
            socket.emit('sendMessage', {
              chat_room_id: roomId,
              message: messageText.trim(),
              tempId: 'temp-' + Date.now() + 1,
            });
          }
        } else {
          throw new Error('Socket disconnected');
        }
      }

      toast({
        title: 'Đã gửi thành công',
        description: `Đã chia sẻ bài viết tới ${selectedUserIds.length} người.`,
      });
      
      // Reset state and close
      setSearchTerm('');
      setSelectedUserIds([]);
      setMessageText('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể chia sẻ bài viết. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border/40 gap-0">
        <DialogHeader className="p-4 border-b border-border/40 flex items-center justify-center relative">
          <DialogTitle className="text-center w-full">Chia sẻ</DialogTitle>
        </DialogHeader>

        <div className="p-4 border-b border-border/40">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm người dùng..."
              className="border-none bg-transparent h-auto p-0 focus-visible:ring-0 shadow-none text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[300px] p-2">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground">
              Không tìm thấy người dùng
            </div>
          ) : (
            users.map((u: any) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                onClick={() => handleToggleUser(u.id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={u.avatar} />
                    <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{u.full_name || u.username}</span>
                    <span className="text-xs text-muted-foreground">{u.username}</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary pointer-events-none"
                  checked={selectedUserIds.includes(u.id)}
                  readOnly
                />
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border/40 flex flex-col gap-3">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Viết tin nhắn..."
            className="bg-muted/50 border-none focus-visible:ring-0 shadow-none"
          />
          <Button
            className="w-full"
            disabled={selectedUserIds.length === 0 || isSending}
            onClick={handleSend}
          >
            {isSending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {selectedUserIds.length > 1 ? 'Gửi riêng biệt' : 'Gửi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
