import { useState, useEffect, useRef } from 'react';
import {
  useChatRoomsControllerFindChatRoomById,
  useChatMessagesControllerGetMessageHistory,
  chatRoomsControllerMarkRoomAsRead,
  getChatMessagesControllerGetMessageHistoryQueryKey,
} from '@/services/apis/gen/queries';
import { useFloatingChatStore } from '@/features/chats/stores/floating-chat-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2,
  Maximize2,
  X,
  ArrowLeft,
  Send,
  ImageIcon,
  Smile,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useNavigate } from 'react-router-dom';
import { socketService } from '@/services/socket.service';
import { useQueryClient } from '@tanstack/react-query';

type FloatingRoomMember = {
  id: string;
  username?: string;
  full_name?: string;
  avatar?: string;
  profile_picture_url?: string;
};

type FloatingRoom = {
  id: string;
  name?: string;
  type?: string;
  avatar?: string;
  members?: FloatingRoomMember[];
};

type FloatingMessage = {
  id: string;
  chat_room_id: string;
  created_by: string;
  message?: string;
  content?: string;
  created_at?: string;
};

export function FloatingChatRoom({ roomId }: { roomId: string }) {
  const { user } = useAuthStore();
  const {
    goBackToList,
    closeChat,
    hasUnreadInOtherRoom,
    setHasUnreadInOtherRoom,
  } = useFloatingChatStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messageText, setMessageText] = useState('');

  const { data: roomData, isLoading: isLoadingRoom } =
    useChatRoomsControllerFindChatRoomById(roomId);
  const roomPayload = roomData as unknown as { data?: FloatingRoom };
  const room = roomPayload?.data;

  const { data: messagesData, isLoading: isLoadingMessages } =
    useChatMessagesControllerGetMessageHistory(roomId, {
      limit: 50,
    });

  const messagesPayload = messagesData as unknown as {
    data?: { data?: FloatingMessage[] };
  };
  const messages = messagesPayload?.data?.data || [];

  // Scroll to bottom on load or new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark as read when entering
  useEffect(() => {
    chatRoomsControllerMarkRoomAsRead(roomId).catch(() => {});
  }, [roomId, messages.length]);

  // Handle Socket Events
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const appendMessageToCache = (newMsg: FloatingMessage) => {
      if (newMsg.chat_room_id === roomId) {
        queryClient.setQueryData(
          getChatMessagesControllerGetMessageHistoryQueryKey(roomId, {
            limit: 50,
          }),
          (old: unknown) => {
            const cached = old as { data?: { data?: FloatingMessage[] } };
            if (!cached.data?.data) return old;
            // Prevent duplicates
            if (cached.data?.data?.some((m) => m.id === newMsg.id)) return old;

            return {
              ...cached,
              data: {
                ...cached.data,
                data: [...(cached.data?.data || []), newMsg],
              },
            };
          },
        );
        // Mark read
        if (newMsg.created_by !== user?.id) {
          chatRoomsControllerMarkRoomAsRead(roomId).catch(() => {});
        }
      } else {
        // From another room -> Show red dot on back button
        setHasUnreadInOtherRoom(true);
      }
    };

    const handleNewMessage = (newMsg: FloatingMessage) => {
      appendMessageToCache(newMsg);
    };

    const handleMessageSaved = (payload: { message?: FloatingMessage }) => {
      if (payload.message) appendMessageToCache(payload.message);
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageSaved', handleMessageSaved);
    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageSaved', handleMessageSaved);
    };
  }, [roomId, queryClient, user?.id, setHasUnreadInOtherRoom]);

  const handleExpand = () => {
    closeChat();
    navigate(`/messages/${roomId}`);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('sendMessage', {
        chat_room_id: roomId,
        message: messageText.trim(),
        tempId: `floating-${Date.now()}`,
      });
      setMessageText('');
    }
  };

  if (isLoadingRoom) {
    return (
      <div className="flex flex-col h-[500px] w-[340px] bg-card border border-border shadow-2xl rounded-t-xl overflow-hidden pointer-events-auto z-50">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isGroup = room?.type === 'group';
  const otherUser = room?.members?.find((m) => m.id !== user?.id);

  const roomName = isGroup
    ? room?.name || 'Group Chat'
    : otherUser?.username || otherUser?.full_name || 'Người dùng';

  const roomAvatar = isGroup
    ? room?.avatar
    : otherUser?.profile_picture_url ||
      otherUser?.avatar ||
      '/default-avatar.png';

  const displayMessages = messages;

  return (
    <div className="flex flex-col h-[500px] w-[340px] bg-card border border-border shadow-2xl rounded-t-xl overflow-hidden pointer-events-auto z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={goBackToList}
            className="p-2 hover:bg-secondary rounded-full transition-colors relative"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4 text-snet-purple" />
            {hasUnreadInOtherRoom && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-card" />
            )}
          </button>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={roomAvatar} className="object-cover" />
            <AvatarFallback className="bg-muted text-xs">
              {roomName?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-bold truncate max-w-[120px]">
              {roomName}
            </span>
          </div>
        </div>
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
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-secondary/10 flex flex-col gap-3"
      >
        {isLoadingMessages ? (
          <div className="flex justify-center my-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          displayMessages.map((msg) => {
            const isMe = msg.created_by === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div
                  className={`px-3 py-2 rounded-2xl ${
                    isMe
                      ? 'bg-snet-purple text-white rounded-br-sm'
                      : 'bg-secondary text-foreground rounded-bl-sm border border-border'
                  }`}
                  style={{ wordBreak: 'break-word' }}
                >
                  <span className="text-[14px] leading-relaxed">
                    {msg.message || msg.content}
                  </span>
                </div>
                {/* <span className="text-[10px] text-muted-foreground mt-1 mx-1">{formatTimeAgo(msg.created_at)}</span> */}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border bg-card shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-secondary rounded-full px-3 py-1.5 border border-transparent focus-within:border-snet-purple/30 focus-within:bg-background transition-all">
            <button
              type="button"
              className="text-muted-foreground hover:text-snet-purple shrink-0 mr-2"
            >
              <Smile className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Nhắn tin..."
              className="flex-1 bg-transparent border-none outline-none text-sm h-8"
            />
            <button
              type="button"
              className="text-muted-foreground hover:text-snet-purple shrink-0 ml-2"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!messageText.trim()}
            className="p-2 rounded-full bg-snet-purple text-white disabled:opacity-50 disabled:bg-secondary disabled:text-muted-foreground transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
