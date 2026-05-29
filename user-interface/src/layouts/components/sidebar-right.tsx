import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function SidebarRight() {
  const currentUser = {
    username: 'alan29204',
    name: 'Nguyễn Quang Huy',
    avatar: 'https://github.com/shadcn.png',
  };

  const suggestions = [
    { id: 1, username: 'snet_user_1', info: 'Gợi ý cho bạn', avatar: '' },
    { id: 2, username: 'snet_user_2', info: 'Gợi ý cho bạn', avatar: '' },
    { id: 3, username: 'snet_user_3', info: 'Mới tham gia Instagram', avatar: '' },
    { id: 4, username: 'snet_user_4', info: 'Gợi ý cho bạn', avatar: '' },
    { id: 5, username: 'snet_user_5', info: 'Gợi ý cho bạn', avatar: '' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-[320px] pt-8 px-4 h-full">
      {/* Current User */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 cursor-pointer">
          <Avatar className="w-11 h-11">
            <AvatarImage src={currentUser.avatar} />
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{currentUser.username}</span>
            <span className="text-sm text-muted-foreground">{currentUser.name}</span>
          </div>
        </div>
        <button className="text-xs font-semibold text-primary hover:text-primary/80">
          Chuyển
        </button>
      </div>

      {/* Suggestions Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-muted-foreground">
          Gợi ý cho bạn
        </span>
        <button className="text-xs font-semibold hover:text-muted-foreground">
          Xem tất cả
        </button>
      </div>

      {/* Suggestion List */}
      <div className="flex flex-col gap-4">
        {suggestions.map((user) => (
          <div key={user.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-secondary text-xs uppercase">
                  {user.username.substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">{user.username}</span>
                <span className="text-[11px] text-muted-foreground">
                  {user.info}
                </span>
              </div>
            </div>
            <button className="text-xs font-semibold text-primary hover:text-primary/80">
              Theo dõi
            </button>
          </div>
        ))}
      </div>

      {/* Footer Links */}
      <div className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground/60">
          <a href="#" className="hover:underline">Giới thiệu</a> • 
          <a href="#" className="hover:underline">Trợ giúp</a> • 
          <a href="#" className="hover:underline">Báo chí</a> • 
          <a href="#" className="hover:underline">API</a> • 
          <a href="#" className="hover:underline">Việc làm</a> • 
          <a href="#" className="hover:underline">Quyền riêng tư</a> • 
          <a href="#" className="hover:underline">Điều khoản</a>
        </div>
        <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">
          © 2026 SNET FROM ALAN29204
        </span>
      </div>
    </aside>
  );
}
