import { Outlet } from 'react-router-dom';
import { SidebarLeft } from './components/sidebar-left';
import { GlobalPostModal } from '@/features/posts/components/global-post-modal';

export function MainLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <SidebarLeft />
      
      {/* Main scrollable content area */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <Outlet />
      </main>

      <GlobalPostModal />
    </div>
  );
}
