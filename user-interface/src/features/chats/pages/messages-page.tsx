import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Edit, Phone, Video, Info, MoreVertical, Search, Smile, Image as ImageIcon, Mic, Heart, Forward, Copy, Pin, Flag, Languages } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      
      {/* Left Sidebar - Chat List */}
      <div className="w-[350px] flex flex-col border-r border-border/40">
        
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-6 shrink-0 pt-4">
          <div className="flex items-center gap-2 font-bold text-xl cursor-pointer">
            {user?.username} <span className="text-sm">⌄</span>
          </div>
          <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
            <Edit className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-2 shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/50 hover:bg-muted rounded-xl text-sm outline-none transition-colors"
            />
          </div>
        </div>

        {/* Tabs / Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <span className="font-bold text-base">Tin nhắn</span>
          <button className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Tin nhắn đang chờ
          </button>
        </div>

        {/* Chat List (Hardcoded for UI Phase 1) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
          {/* Active item */}
          <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer bg-muted/50">
            <Avatar className="w-14 h-14 shrink-0">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>QM</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate">Nguyễn Quang Minh</p>
              <p className="text-sm text-muted-foreground truncate">
                Cuộc gọi thoại đã kết thúc · 3 giờ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
            <Avatar className="w-14 h-14 shrink-0">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>VT</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate">Vẫn Là Thắng</p>
              <p className="text-sm text-muted-foreground truncate">
                Hoạt động 7 phút trước
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
            <Avatar className="w-14 h-14 shrink-0">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>AN</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate">Alan Nguyen</p>
              <p className="text-sm text-muted-foreground truncate">
                Các bạn hiện đã là bạn bè... · 17 giờ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
            <Avatar className="w-14 h-14 shrink-0">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>AN</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate">An Na</p>
              <p className="text-sm text-muted-foreground truncate">
                Hoạt động 1 giờ trước
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Right Column - Chat View */}
      <div className="flex-1 flex flex-col bg-background relative">
        
        {/* Chat Header */}
        <div className="h-[75px] border-b border-border/40 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3 cursor-pointer">
            <Avatar className="w-11 h-11">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>QM</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-base">Nguyễn Quang Minh</p>
              <p className="text-xs text-muted-foreground">Hoạt động 3 giờ trước</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-foreground">
            <button className="hover:opacity-70"><Phone className="w-6 h-6" /></button>
            <button className="hover:opacity-70"><Video className="w-7 h-7" /></button>
            <button className="hover:opacity-70"><Info className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          
          {/* Avatar introduction */}
          <div className="flex flex-col items-center justify-center pt-8 pb-12 gap-3">
            <Avatar className="w-24 h-24">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>QM</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold">Nguyễn Quang Minh</h2>
            <p className="text-muted-foreground text-sm">social-network-cnet</p>
            <button className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg font-semibold text-sm hover:bg-secondary/80">
              Xem trang cá nhân
            </button>
          </div>

          {/* System Messages */}
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Bạn đã bắt đầu cuộc gọi thoại</span>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Cuộc gọi thoại đã kết thúc</span>
          </div>

          {/* User Message (Left) */}
          <div className="flex items-end gap-2 group">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>QM</AvatarFallback>
            </Avatar>
            <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[60%] text-[15px]">
              Tối nay đi nhậu không fen?
            </div>
            {/* Popover trigger area */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer p-1">
                  <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 rounded-xl">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center border-b mb-1">
                  22:59 7/9/25
                </div>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                  Chuyển tiếp <Forward className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                  Sao chép <Copy className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                  Translate <Languages className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                  Ghim <Pin className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 text-destructive focus:text-destructive rounded-lg">
                  Báo cáo <Flag className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* My Message (Right) */}
          <div className="flex items-end gap-2 justify-end group">
            {/* Popover trigger area */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer p-1">
                  <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center border-b mb-1">
                  23:05 Hôm nay
                </div>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                  Chuyển tiếp <Forward className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                  Sao chép <Copy className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                  Translate <Languages className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                  Ghim <Pin className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer flex justify-between py-2 text-destructive focus:text-destructive rounded-lg">
                  Báo cáo <Flag className="w-4 h-4 ml-2" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="bg-[#0084ff] text-white px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[60%] text-[15px]">
              Oke chốt kèo nhé!
            </div>
          </div>

        </div>

        {/* Chat Input */}
        <div className="p-4 shrink-0">
          <div className="flex items-center gap-2 border border-border/50 bg-background rounded-full px-2 py-1">
            <button className="p-2 text-foreground hover:opacity-70">
              <Smile className="w-6 h-6" />
            </button>
            <input 
              type="text" 
              placeholder="Nhắn tin..."
              className="flex-1 bg-transparent outline-none text-[15px]"
            />
            <div className="flex items-center text-foreground">
              <button className="p-2 hover:opacity-70"><Mic className="w-6 h-6" /></button>
              <button className="p-2 hover:opacity-70"><ImageIcon className="w-6 h-6" /></button>
              <button className="p-2 hover:opacity-70"><Heart className="w-6 h-6" /></button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
