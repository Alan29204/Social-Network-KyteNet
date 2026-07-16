import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { NotificationDrawer } from '@/features/notifications/components/notification-drawer';
import {
  useChatRoomsControllerGetListChatRoom,
  useNotificationControllerGetUnreadCount,
} from '@/services/apis/gen/queries';

/**
 * Thanh header chỉ dành cho mobile (<768px).
 *
 * Lý do tồn tại: SidebarLeft là `hidden md:flex` nên trên mobile không có lối
 * vào Tin nhắn và Thông báo — MobileBottomNav chỉ có 5 mục (Trang chủ, Tìm
 * kiếm, Tạo, Reels, Hồ sơ). Header này bù đúng hai lối vào còn thiếu.
 */
export function MobileHeader() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const { data: chatRoomsResponse } = useChatRoomsControllerGetListChatRoom(
    { page: 1, limit: 50 },
    { query: { enabled: !!user && !!accessToken } },
  );

  const { data: unreadNotificationsRes } =
    useNotificationControllerGetUnreadCount({
      query: {
        enabled: !!user && !!accessToken,
        refetchInterval: 30000,
      },
    });

  const rooms = (chatRoomsResponse as any)?.data?.data || [];
  const unreadChatCount = rooms.filter(
    (room: any) => room.unread_count > 0,
  ).length;

  const unreadNotificationCount =
    (unreadNotificationsRes as any)?.data?.data?.unread_count ||
    (unreadNotificationsRes as any)?.data?.unread_count ||
    0;

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-lg border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kyte-blue to-kyte-coral flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <span className="font-heading font-bold text-lg">KyteNet</span>
        </Link>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsNotificationOpen(true)}
            className="relative p-2 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="Thông báo"
          >
            <Bell className="w-6 h-6" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/messages')}
            className="relative p-2 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="Tin nhắn"
          >
            <MessageCircle className="w-6 h-6" />
            {unreadChatCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </>
  );
}
