import { useLocation } from 'react-router-dom';
import { useFloatingChatStore } from '@/features/chats/stores/floating-chat-store';
import { FloatingChatList } from './floating-chat-list';
import { FloatingChatRoom } from './floating-chat-room';
import { Send } from 'lucide-react';
import { useChatRoomsControllerGetListChatRoom } from '@/services/apis/gen/queries';

export function FloatingChat() {
  const location = useLocation();
  const { isOpen, activeRoomId, toggleOpen } = useFloatingChatStore();

  const { data: roomsRes } = useChatRoomsControllerGetListChatRoom({
    page: 1,
    limit: 50, // Get enough to check total unread
  });
  
  const rooms = roomsRes?.data?.data || [];
  const unreadTotal = rooms.reduce((acc: number, room: any) => acc + (room.unread_count || 0), 0);

  // Không hiển thị ở trang tin nhắn hoặc trang chỉnh sửa hồ sơ
  if (location.pathname.startsWith('/messages') || location.pathname === '/profile/edit') {
    return null;
  }

  return (
    <div className="fixed bottom-0 right-4 lg:right-24 z-50 flex flex-col items-end pointer-events-none">
      {/* Khung chứa cửa sổ chat nổi */}
      <div 
        className={`transition-all duration-300 ease-out origin-bottom-right mb-4 ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none absolute bottom-12'
        }`}
      >
        {isOpen && (
          activeRoomId ? (
            <FloatingChatRoom roomId={activeRoomId} />
          ) : (
            <FloatingChatList />
          )
        )}
      </div>

      {/* Nút Trigger (Nút Tin nhắn) */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className="pointer-events-auto flex items-center gap-2 px-5 py-3.5 mb-0 rounded-t-2xl shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)] bg-card border border-border border-b-0 hover:bg-secondary/80 transition-all group"
        >
          <div className="relative">
            <svg
              className="w-5 h-5 text-foreground group-hover:text-snet-purple transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            {unreadTotal > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card" />
            )}
          </div>
          <span className="font-bold text-[15px]">Tin nhắn</span>
        </button>
      )}
    </div>
  );
}
