import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CreatePostModal } from '@/features/posts/components/create-post-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import {
  Home,
  Search,
  Compass,
  MessageCircle,
  Heart,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Trang chủ', href: '/' },
  { icon: Search, label: 'Tìm kiếm', href: '/search' },
  { icon: Compass, label: 'Khám phá', href: '/explore' },
  { icon: MessageCircle, label: 'Tin nhắn', href: '/messages' },
  { icon: Heart, label: 'Thông báo', href: '/notifications' },
  { icon: PlusSquare, label: 'Tạo', href: '/create' },
  { icon: User, label: 'Trang cá nhân', href: '/profile' },
];

export function SidebarLeft() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Spacer to prevent content from going under the fixed sidebar */}
      <div className="hidden md:block w-[72px] shrink-0 min-h-screen" />

      <aside className="group hidden md:flex flex-col fixed top-0 left-0 z-30 min-h-screen bg-background border-r border-border w-[72px] hover:w-[244px] transition-all duration-300 shadow-none hover:shadow-xl">
        {/* Logo */}
        <div className="px-4 h-[72px] flex items-center group-hover:px-6 transition-all mt-4 mb-4">
          <span className="group-hover:hidden text-2xl font-bold text-foreground shrink-0 select-none mx-auto tracking-tighter">
            S
          </span>
          <span className="hidden group-hover:block text-2xl font-bold text-foreground select-none tracking-tight">
            SNet
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
                  <div className="relative shrink-0 flex items-center justify-center w-6 h-6 mx-auto group-hover:mx-0 transition-all">
                    <item.icon strokeWidth={2} className="w-6 h-6 text-foreground/80" />
                  </div>
                  <span className="hidden group-hover:block text-[15px] leading-snug whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
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
                    if (href === '/') queryClient.invalidateQueries({ queryKey: ['feed'] });
                    if (href === '/explore') queryClient.invalidateQueries({ queryKey: ['feed', 'foryou'] });
                    if (href.startsWith('/profile')) queryClient.invalidateQueries({ queryKey: ['profile'] });
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-secondary transition-all',
                    isActive ? 'font-bold' : 'font-medium'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative shrink-0 flex items-center justify-center w-6 h-6 mx-auto group-hover:mx-0 transition-all">
                      <item.icon
                        strokeWidth={isActive ? 2.5 : 2}
                        className={cn(
                          'w-6 h-6',
                          isActive ? 'text-foreground' : 'text-foreground/80'
                        )}
                      />
                    </div>
                    <span className="hidden group-hover:block text-[15px] leading-snug whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
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
                <div className="relative shrink-0 flex items-center justify-center w-6 h-6 mx-auto group-hover:mx-0 transition-all">
                  <Menu strokeWidth={2} className="w-6 h-6 text-foreground/80" />
                </div>
                <span className="hidden group-hover:block text-[15px] leading-snug whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
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
              <DropdownMenuItem className="p-3 cursor-pointer rounded-lg text-[15px]">
                <Settings className="mr-3 h-5 w-5" />
                <span>Cài đặt</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-3 cursor-pointer rounded-lg text-[15px]">
                <Activity className="mr-3 h-5 w-5" />
                <span>Hoạt động của bạn</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-3 cursor-pointer rounded-lg text-[15px]">
                <Bookmark className="mr-3 h-5 w-5" />
                <span>Đã lưu</span>
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
              <DropdownMenuItem className="p-3 cursor-pointer rounded-lg text-[15px]">
                <MessageSquareWarning className="mr-3 h-5 w-5" />
                <span>Báo cáo sự cố</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="my-1" />
              
              <DropdownMenuItem className="p-3 cursor-pointer rounded-lg text-[15px]">
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
      <CreatePostModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
    </>
  );
}
