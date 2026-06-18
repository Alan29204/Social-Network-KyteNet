import { useChatRoomsControllerGetListChatRoom } from '@/services/apis/gen/queries';
import { useFloatingChatStore } from '@/features/chats/stores/floating-chat-store';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Maximize2, X } from 'lucide-react';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useNavigate } from 'react-router-dom';

export function FloatingChatList() {
  const { user } = useAuthStore();
  const { openRoom, closeChat } = useFloatingChatStore();
  const navigate = useNavigate();

  const { data: roomsRes, isLoading } = useChatRoomsControllerGetListChatRoom({
    page: 1,
    limit: 20,
  });

  const rooms = roomsRes?.data?.data || [];

  const handleExpand = () => {
    closeChat();
    navigate('/messages');
  };

  return (
    <div className="flex flex-col h-[500px] w-[340px] bg-card border border-border shadow-2xl rounded-t-xl overflow-hidden pointer-events-auto z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card/95 backdrop-blur-sm shrink-0">
        <h3 className="font-bold text-[15px]">Tin nhắn</h3>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            onClick={handleExpand}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
            title="Mở toàn màn hình"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={closeChat}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <span className="text-sm">Chưa có tin nhắn nào.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {rooms.map((room: any) => {
              const isGroup = room.type === 'group';
              const otherUser = room.members?.find((m: any) => m.id !== user?.id);

              const roomName = isGroup 
                ? (room.name || 'Group Chat')
                : (otherUser?.username || otherUser?.full_name || 'Người dùng');
                
              const roomAvatar = isGroup 
                ? room.avatar 
                : (otherUser?.profile_picture_url || otherUser?.avatar || '/default-avatar.png');

              const lastMessage = room.last_message;
              const isUnread = room.unread_count > 0;

              return (
                <button
                  key={room.id}
                  onClick={() => openRoom(room.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors text-left ${
                    isUnread ? 'bg-secondary/30' : ''
                  }`}
                >
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarImage src={roomAvatar} className="object-cover" />
                    <AvatarFallback className="bg-muted text-sm">
                      {roomName?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`text-sm truncate ${isUnread ? 'font-bold' : 'font-medium'}`}>
                      {roomName}
                    </span>
                    {lastMessage && (
                      <span
                        className={`text-xs truncate ${
                          isUnread
                            ? 'font-bold text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {lastMessage.created_by === user?.id && 'Bạn: '}
                        {lastMessage.type === 'text'
                          ? lastMessage.content
                          : lastMessage.type === 'image'
                          ? 'Đã gửi một hình ảnh'
                          : lastMessage.type === 'video'
                          ? 'Đã gửi một video'
                          : 'Đã gửi một tệp'}
                        <span className="mx-1">·</span>
                        {formatTimeAgo(lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  {isUnread && (
                    <div className="w-2.5 h-2.5 bg-snet-purple rounded-full shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
