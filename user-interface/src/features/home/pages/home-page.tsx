import { SidebarRight } from '@/layouts/components/sidebar-right';

export default function HomePage() {
  return (
    <div className="flex justify-center w-full min-h-screen">
      {/* Center Feed Area */}
      <div className="flex flex-col w-full max-w-[470px] mt-8 px-4 sm:px-0">
        <h2 className="text-xl font-bold mb-6">Trang chủ</h2>
        {/* Placeholder for feed posts */}
        <div className="flex flex-col gap-6">
          <div className="w-full h-[600px] border border-border rounded-lg bg-card animate-pulse"></div>
          <div className="w-full h-[600px] border border-border rounded-lg bg-card animate-pulse"></div>
        </div>
      </div>

      {/* Right Sidebar Area (Only visible on lg+ screens) */}
      <div className="hidden lg:block ml-16 w-[320px]">
        <SidebarRight />
      </div>
    </div>
  );
}
