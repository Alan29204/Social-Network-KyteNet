import { useChatRoomsControllerGetListChatRoom } from '@/services/apis/gen/queries';
import { useFloatingChatStore } from '@/features/chats/stores/floating-chat-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Maximize, X } from 'lucide-react';
import { formatTimeAgo } from '@/utils/date-formatter';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useNavigate } from 'react-router-dom';
import { getDisplayName, getGroupAvatarUrl, getUserAvatarUrl } from '@/utils/user';

type FloatingChatMember = {
  id: string;
  username?: string;
  full_name?: string;
  avatar?: string;
  profile_picture_url?: string;
};

type FloatingChatRoomSummary = {
  id: string;
  name?: string;
  type?: string;
  avatar?: string;
  members?: FloatingChatMember[];
  unread_count?: number;
  last_message?: {
    message?: string;
    content?: string;
    type?: string;
    message_type?: string;
    message_status?: string;
    medias?: string[];
    created_by?: string;
    created_at?: string;
    user?: FloatingChatMember;
  };
};

export function FloatingChatList() {
  const { user } = useAuthStore();
  const { openRoom, closeChat } = useFloatingChatStore();
  const navigate = useNavigate();

  const { data: roomsRes, isLoading } = useChatRoomsControllerGetListChatRoom({
    page: 1,
    limit: 20,
  });

  const roomsPayload = roomsRes as unknown as {
    data?: { data?: FloatingChatRoomSummary[] };
  };
  const rooms = roomsPayload?.data?.data || [];

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
            <Maximize className="w-4 h-4" />
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
            {rooms.map((room) => {
              const isGroup = room.type === 'group';
              const otherUser = room.members?.find((m) => m.id !== user?.id);

              const roomName = isGroup 
                ? (room.name || 'Group Chat')
                : getDisplayName(otherUser);
                
              const roomAvatar = isGroup 
                ? getGroupAvatarUrl(room.avatar)
                : getUserAvatarUrl(otherUser);

              const lastMessage = room.last_message;
              const isUnread = (room.unread_count || 0) > 0;
              const lastMessageActor =
                lastMessage?.user ||
                room.members?.find((member) => member.id === lastMessage?.created_by);
              const isSystemLastMessage =
                (lastMessage?.message_type || lastMessage?.message_status || lastMessage?.type || '')
                  .toLowerCase() === 'system';
              const rawLastMessageText =
                lastMessage?.message ||
                lastMessage?.content ||
                (lastMessage?.medias?.length
                  ? 'Đã gửi một tệp'
                  : 'Đã gửi một tin nhắn');
              const lastMessageText =
                isSystemLastMessage &&
                rawLastMessageText.trim().toLowerCase() === 'đã tạo nhóm'
                  ? `${getDisplayName(lastMessageActor)} đã tạo nhóm`
                  : rawLastMessageText;

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
                    <AvatarFallback className="bg-muted text-sm" />
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
                        {!isSystemLastMessage && lastMessage.created_by === user?.id && 'Bạn: '}
                        {lastMessageText}
                        <span className="mx-1">·</span>
                        {lastMessage.created_at
                          ? formatTimeAgo(lastMessage.created_at)
                          : ''}
                      </span>
                    )}
                  </div>
                  {isUnread && (
                    <div className="w-2.5 h-2.5 bg-kyte-blue rounded-full shrink-0" />
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
