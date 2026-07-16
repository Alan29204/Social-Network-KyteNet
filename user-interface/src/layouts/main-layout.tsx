import { Outlet, useLocation } from 'react-router-dom';
import { SidebarLeft } from './components/sidebar-left';
import { MobileHeader } from './components/mobile-header';
import { MobileBottomNav } from './components/mobile-bottom-nav';
import { GlobalPostModal } from '@/features/posts/components/global-post-modal';
import { FloatingChat } from '@/features/chats/components/floating-chat';

/** Trang tự có header riêng trên mobile → không chồng thêm MobileHeader. */
const HIDE_MOBILE_HEADER = [/^\/reels/, /^\/messages/];

/**
 * Trang chiếm trọn màn hình và tự có nút thoát → ẩn MobileBottomNav.
 * Lưu ý: `/messages` (danh sách) VẪN giữ nav, nếu không người dùng mobile
 * không có đường quay ra. Chỉ ẩn khi đã mở một phòng chat cụ thể.
 */
const HIDE_MOBILE_NAV = [/^\/reels/, /^\/messages\/.+/];

export function MainLayout() {
  const { pathname } = useLocation();
  const hideHeader = HIDE_MOBILE_HEADER.some((re) => re.test(pathname));
  const hideNav = HIDE_MOBILE_NAV.some((re) => re.test(pathname));

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarLeft />

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header mobile: bù lối vào Tin nhắn + Thông báo (sidebar bị ẩn <768px) */}
        {!hideHeader && <MobileHeader />}

        {/* Chừa chỗ cho thanh điều hướng mobile (h-14) */}
        <main
          className={`flex-1 flex flex-col min-w-0 ${
            hideNav ? '' : 'pb-14 md:pb-0'
          }`}
        >
          <Outlet />
        </main>
      </div>

      <GlobalPostModal />

      {/* Chat nổi chỉ dành cho desktop: trên mobile nó đè lên MobileBottomNav */}
      <div className="hidden md:block">
        <FloatingChat />
      </div>

      {!hideNav && <MobileBottomNav />}
    </div>
  );
}
