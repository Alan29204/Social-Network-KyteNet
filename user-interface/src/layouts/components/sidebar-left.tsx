import { NavLink } from 'react-router-dom';
import {
  Home,
  Search,
  Compass,
  MessageCircle,
  Heart,
  PlusSquare,
  User,
  Menu,
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
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.href}
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
          ))}
        </nav>

        {/* Footer actions (More) */}
        <div className="px-3 pb-6 mt-auto">
          <button className="flex w-full items-center gap-4 px-3 py-3 rounded-lg hover:bg-secondary transition-all font-medium">
            <div className="relative shrink-0 flex items-center justify-center w-6 h-6 mx-auto group-hover:mx-0 transition-all">
              <Menu strokeWidth={2} className="w-6 h-6 text-foreground/80" />
            </div>
            <span className="hidden group-hover:block text-[15px] leading-snug whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
              Xem thêm
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
