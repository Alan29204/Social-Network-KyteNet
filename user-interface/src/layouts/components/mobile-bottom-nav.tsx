import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useState } from 'react';
import { CreatePostModal } from '@/features/posts/components/create-post-modal';
import { Home, Search, Compass, PlusSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Trang chủ', href: '/' },
  { icon: Search, label: 'Tìm kiếm', href: '/search' },
  { icon: PlusSquare, label: 'Tạo', href: '/create' },
  { icon: Compass, label: 'Khám phá', href: '/explore' },
  { icon: User, label: 'Hồ sơ', href: '/profile' },
];

export function MobileBottomNav() {
  const { user } = useAuthStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/80 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item) => {
            if (item.label === 'Tạo') {
              return (
                <button
                  key={item.label}
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-snet-purple to-snet-pink text-white shadow-lg shadow-snet-purple/20 hover:opacity-90 transition-all active:scale-95"
                >
                  <PlusSquare className="w-5 h-5" />
                </button>
              );
            }

            let href = item.href;
            if (item.label === 'Hồ sơ' && user?.id) {
              href = `/profile/${user.id}`;
            }

            const isActive =
              location.pathname === href ||
              (item.label === 'Trang chủ' && location.pathname === '/');

            return (
              <NavLink
                key={item.label}
                to={href}
                className={cn(
                  'flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all',
                  isActive
                    ? 'text-snet-purple'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon
                  className={cn(
                    'w-5 h-5 transition-all',
                    isActive && 'stroke-[2.5]',
                  )}
                />
              </NavLink>
            );
          })}
        </div>
      </nav>

      <CreatePostModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </>
  );
}
