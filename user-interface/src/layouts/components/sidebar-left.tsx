import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CreatePostModal } from '@/features/posts/components/create-post-modal';
import { NotificationDrawer } from '@/features/notifications/components/notification-drawer';
import { BlockedAccountsModal } from '@/features/settings/components/blocked-accounts-modal';
import { FollowRequestsModal } from '@/features/profile/components/follow-requests-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { socketService } from '@/services/socket.service';
import {
  Home,
  Search,
  Film,
  MessageCircle,
  Bell,
  PlusSquare,
  User,
  Menu,
  Settings,
  Activity,
  Bookmark,
  Sun,
  Moon,
  MessageSquareWarning,
  RefreshCw,
  LogOut,
  Ban,
  UserPlus,
} from 'lucide-react';
import {
  getChatRoomsControllerGetListChatRoomQueryKey,
  useChatRoomsControllerGetListChatRoom,
  useNotificationControllerGetUnreadCount,
  getNotificationControllerGetUnreadCountQueryKey,
  getNotificationControllerGetUserNotificationsInfiniteQueryKey,
} from '@/services/apis/gen/queries';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Trang chủ', href: '/' },
  { icon: Search, label: 'Tìm kiếm', href: '/search' },
  { icon: Film, label: 'Reels', href: '/reels' },
  { icon: MessageCircle, label: 'Tin nhắn', href: '/messages' },
  { icon: Bell, label: 'Thông báo', href: '/notifications' },
  { icon: PlusSquare, label: 'Tạo', href: '/create' },
  { icon: User, label: 'Trang cá nhân', href: '/profile' },
];

export function SidebarLeft() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isBlockedAccountsOpen, setIsBlockedAccountsOpen] = useState(false);
  const [isFollowRequestsOpen, setIsFollowRequestsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, accessToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const match = location.pathname.match(/^\/messages\/([^/]+)/);
  const selectedRoomId = match ? match[1] : null;

  const { data: chatRoomsResponse } = useChatRoomsControllerGetListChatRoom(
    { page: 1, limit: 50 },
    {
      query: {
        enabled: !!user && !!accessToken,
      },
    },
  );

  const { data: unreadNotificationsRes } =
    useNotificationControllerGetUnreadCount({
      query: {
        enabled: !!user && !!accessToken,
        refetchInterval: 30000, // Optional fallback, but WebSockets are better
      },
    });

  const unreadNotificationCount =
    (unreadNotificationsRes as any)?.data?.data?.unread_count ||
    (unreadNotificationsRes as any)?.data?.unread_count ||
    0;

  useEffect(() => {
    // Update browser title
    if (unreadNotificationCount > 0) {
      document.title = `(${unreadNotificationCount}) KyteNet`;
    } else {
      document.title = 'KyteNet';
    }
  }, [unreadNotificationCount]);

  const rooms = (chatRoomsResponse as any)?.data?.data || [];
  const unreadCount = rooms.filter((room: any) => room.unread_count > 0).length;

  useEffect(() => {
    const handleOpenFollowRequests = () => {
      setIsFollowRequestsOpen(true);
    };
    window.addEventListener('openFollowRequests', handleOpenFollowRequests);
    return () =>
      window.removeEventListener(
        'openFollowRequests',
        handleOpenFollowRequests,
      );
  }, []);

  useEffect(() => {
    if (!user || !accessToken) return;

    // Ensure socket is connected globally
    socketService.connect(accessToken);
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewMessage = (newMsg: any) => {
      // Update React Query cache for chat list:
      // 1. Increment unread count if it's from someone else and we aren't currently viewing it in full page
      // 2. Update last_message and move room to top
      queryClient.setQueryData(
        getChatRoomsControllerGetListChatRoomQueryKey({ page: 1, limit: 50 }),
        (old: any) => {
          if (!old?.data?.data) return old;
          let foundRoom = null;
          const remainingRooms = old.data.data.filter((r: any) => {
            if (r.id === newMsg.chat_room_id) {
              const shouldIncrementUnread =
                newMsg.created_by !== user.id &&
                (location.pathname !== '/messages' ||
                  selectedRoomId !== newMsg.chat_room_id);

              foundRoom = {
                ...r,
                unread_count: shouldIncrementUnread
                  ? (r.unread_count || 0) + 1
                  : r.unread_count,
                last_message: newMsg,
              };
              return false;
            }
            return true;
          });

          if (foundRoom) {
            return {
              ...old,
              data: { ...old.data, data: [foundRoom, ...remainingRooms] },
            };
          }
          return old;
        },
      );
    };

    const handleReceiveMessage = () => {
      // Refresh chat list
      queryClient.invalidateQueries({
        queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
      });
    };

    const handleReceiveNotification = () => {
      queryClient.invalidateQueries({
        queryKey: getNotificationControllerGetUnreadCountQueryKey(),
      });
      queryClient.invalidateQueries({
        queryKey:
          getNotificationControllerGetUserNotificationsInfiniteQueryKey(),
      });
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('notification', handleReceiveNotification);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('notification', handleReceiveNotification);
    };
  }, [user, accessToken, location.pathname, selectedRoomId, queryClient]);

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Spacer to prevent content from going under the fixed sidebar */}
      <div className="hidden md:block w-[88px] shrink-0 min-h-screen" />

      <aside
        className={cn(
          'group hidden md:flex flex-col fixed top-0 left-0 z-40 min-h-screen bg-background border-r border-border transition-all duration-300 shadow-none hover:shadow-xl',
          isNotificationOpen ? 'w-[88px]' : 'w-[88px] hover:w-[244px]',
        )}
      >
        {/* Logo */}
        <div className="px-4 h-[72px] flex items-center group-hover:px-6 transition-all mt-4 mb-4">
          <img
            src="/kytenet-logo.png"
            alt="KyteNet"
            className={cn(
              'w-12 h-12 shrink-0 mx-auto select-none',
              !isNotificationOpen && 'group-hover:mx-0',
            )}
          />
          <span
            className={cn(
              'hidden text-xl font-bold select-none tracking-tight text-kyte-blue font-heading ml-2',
              !isNotificationOpen && 'group-hover:block',
            )}
          >
            KyteNet
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-2 px-3">
          {navItems.map((item) => {
            if (item.label === 'Tạo') {
              return (
                <button
                  key={item.label}
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-secondary transition-all font-medium text-left outline-none"
                >
                  <div className="relative shrink-0 flex items-center justify-center w-7 h-7 mx-auto group-hover:mx-0 transition-all">
                    <item.icon
                      strokeWidth={2}
                      className="w-7 h-7 text-foreground/80"
                    />
                  </div>
                  <span
                    className={cn(
                      'hidden text-[15px] leading-snug whitespace-nowrap opacity-0 transition-opacity duration-300 delay-100',
                      !isNotificationOpen &&
                        'group-hover:block group-hover:opacity-100',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );
            }

            if (item.label === 'Thông báo') {
              return (
                <button
                  key={item.label}
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className={cn(
                    'flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-secondary transition-all font-medium text-left outline-none',
                    isNotificationOpen && 'font-bold',
                  )}
                >
                  <div className="relative shrink-0 flex items-center justify-center w-7 h-7 mx-auto group-hover:mx-0 transition-all">
                    <item.icon
                      strokeWidth={isNotificationOpen ? 2.5 : 2}
                      className={cn(
                        'w-7 h-7',
                        isNotificationOpen
                          ? 'text-foreground'
                          : 'text-foreground/80',
                      )}
                    />
                    {unreadNotificationCount > 0 &&
                      (unreadNotificationCount > 9 ? (
                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-[2px] border-background" />
                      ) : (
                        <div className="absolute -top-1 -right-1.5 min-w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-sm border border-background">
                          {unreadNotificationCount}
                        </div>
                      ))}
                  </div>
                  <span
                    className={cn(
                      'hidden text-[15px] leading-snug whitespace-nowrap opacity-0 transition-opacity duration-300 delay-100',
                      !isNotificationOpen &&
                        'group-hover:block group-hover:opacity-100',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );
            }

            let href = item.href;
            if (item.label === 'Trang cá nhân' && user?.id) {
              href = `/profile/${user.id}`;
            }

            return (
              <NavLink
                key={item.label}
                to={href}
                onClick={(e) => {
                  if (location.pathname === href) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    // Determine which queries to invalidate based on route
                    if (href === '/')
                      queryClient.invalidateQueries({ queryKey: ['feed'] });
                    if (href.startsWith('/profile'))
                      queryClient.invalidateQueries({ queryKey: ['profile'] });
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-secondary transition-all',
                    isActive ? 'font-bold' : 'font-medium',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative shrink-0 flex items-center justify-center w-7 h-7 mx-auto group-hover:mx-0 transition-all">
                      <item.icon
                        strokeWidth={isActive ? 2.5 : 2}
                        className={cn(
                          'w-7 h-7',
                          isActive ? 'text-foreground' : 'text-foreground/80',
                        )}
                      />
                      {item.label === 'Tin nhắn' && unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1.5 min-w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-sm border border-background">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        'hidden text-[15px] leading-snug whitespace-nowrap opacity-0 transition-opacity duration-300 delay-100',
                        !isNotificationOpen &&
                          'group-hover:block group-hover:opacity-100',
                      )}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer actions (More) */}
        <div className="px-3 pb-6 mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-4 px-3 py-3 rounded-lg hover:bg-secondary transition-all font-medium outline-none">
                <div className="relative shrink-0 flex items-center justify-center w-7 h-7 mx-auto group-hover:mx-0 transition-all">
                  <Menu
                    strokeWidth={2}
                    className="w-7 h-7 text-foreground/80"
                  />
                </div>
                <span
                  className={cn(
                    'hidden text-[15px] leading-snug whitespace-nowrap opacity-0 transition-opacity duration-300 delay-100',
                    !isNotificationOpen &&
                      'group-hover:block group-hover:opacity-100',
                  )}
                >
                  Xem thêm
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={8}
              className="w-64 rounded-xl p-2 shadow-lg"
            >
              <DropdownMenuItem
                asChild
                className="p-3 cursor-pointer rounded-lg text-[15px]"
              >
                <Link to="/profile/edit">
                  <Settings className="mr-3 h-5 w-5" />
                  <span>Cài đặt</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="p-3 rounded-lg text-[15px]">
                <Activity className="mr-3 h-5 w-5" />
                <span>Hoạt động của bạn</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="p-3 cursor-pointer rounded-lg text-[15px]"
              >
                <Link to={user?.id ? `/profile/${user.id}/saved` : '/saved'}>
                  <Bookmark className="mr-3 h-5 w-5" />
                  <span>Đã lưu</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="p-3 cursor-pointer rounded-lg text-[15px]"
                onClick={() => setIsBlockedAccountsOpen(true)}
              >
                <Ban className="mr-3 h-5 w-5" />
                <span>Tài khoản đã chặn</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="p-3 cursor-pointer rounded-lg text-[15px]"
                onClick={() => setIsFollowRequestsOpen(true)}
              >
                <UserPlus className="mr-3 h-5 w-5" />
                <span>Yêu cầu theo dõi</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="p-3 cursor-pointer rounded-lg text-[15px]"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? (
                  <Sun className="mr-3 h-5 w-5" />
                ) : (
                  <Moon className="mr-3 h-5 w-5" />
                )}
                <span>Chuyển chế độ</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="p-3 rounded-lg text-[15px]">
                <MessageSquareWarning className="mr-3 h-5 w-5" />
                <span>Báo cáo sự cố</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem disabled className="p-3 rounded-lg text-[15px]">
                <RefreshCw className="mr-3 h-5 w-5" />
                <span>Chuyển tài khoản</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem
                className="p-3 cursor-pointer rounded-lg text-[15px] text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-5 w-5" />
                <span>Đăng xuất</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Modals */}
      <CreatePostModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />

      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />

      <BlockedAccountsModal
        open={isBlockedAccountsOpen}
        onOpenChange={setIsBlockedAccountsOpen}
      />

      <FollowRequestsModal
        open={isFollowRequestsOpen}
        onOpenChange={setIsFollowRequestsOpen}
      />
    </>
  );
}
