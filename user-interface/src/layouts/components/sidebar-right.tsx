import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Link } from 'react-router-dom';
import { useRelationsControllerGetSuggestedUsers } from '@/services/apis/gen/queries';
import { Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useState, useRef } from 'react';

function SidebarSuggestionItem({ user }: { user: any }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const followTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mutualCount = user.mutual_count || 0;
  const mutualFriends = user.mutual_friends || [];
  
  let infoText = 'Gợi ý cho bạn';
  if (mutualCount === 1 && mutualFriends.length > 0) {
    infoText = `Có ${mutualFriends[0].username} theo dõi`;
  } else if (mutualCount > 1 && mutualFriends.length > 0) {
    infoText = `Có ${mutualFriends[0].username} và ${mutualCount - 1} người khác theo dõi`;
  }

  const toggleFollowMutation = useMutation({
    mutationFn: (action: 'following' | 'none') =>
      orvalClient({ 
        url: '/relations/update', 
        method: 'POST', 
        data: { user_id: user.id, relation: action } 
      }),
  });

  const handleToggleFollow = () => {
    const newStatus = !isFollowing;
    setIsFollowing(newStatus);

    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      toggleFollowMutation.mutate(newStatus ? 'following' : 'none');
    }, 500);
  };

  return (
    <div className="flex items-center justify-between">
      <Link to={`/profile/${user.id}`} className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 mr-2">
        <div className="relative shrink-0">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user.avatar || '/default-avatar.png'} />
            <AvatarFallback className="bg-secondary text-xs uppercase">
              {user.username.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          {mutualFriends.length > 0 && (
            <Avatar className="w-3.5 h-3.5 absolute -bottom-1 -right-1 ring-2 ring-background">
              <AvatarImage src={mutualFriends[0].avatar || '/default-avatar.png'} />
              <AvatarFallback className="text-[8px] uppercase">
                {mutualFriends[0].username[0]}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold truncate">{user.username}</span>
          <span className="text-[11px] text-muted-foreground truncate" title={infoText}>
            {infoText}
          </span>
        </div>
      </Link>
      <button 
        onClick={handleToggleFollow}
        className={
          isFollowing
            ? "text-xs font-semibold text-muted-foreground hover:text-muted-foreground/80 shrink-0"
            : "text-xs font-semibold text-primary hover:text-primary/80 shrink-0"
        }
      >
        {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
      </button>
    </div>
  );
}

export function SidebarRight() {
  const { user: authUser } = useAuthStore();
  
  const currentUser = {
    id: authUser?.id || '',
    username: authUser?.username || 'user',
    name: authUser?.email || '',
    avatar: authUser?.avatar || '/default-avatar.png',
  };

  const { data: suggestedRes, isLoading } = useRelationsControllerGetSuggestedUsers({ limit: 5 });
  const suggestions = Array.isArray(suggestedRes?.data) ? suggestedRes.data : [];

  return (
    <aside className="hidden lg:flex flex-col w-[320px] pt-8 px-4 h-full">
      {/* Current User */}
      <div className="flex items-center justify-between mb-6">
        <Link to={`/profile/${currentUser.id}`} className="flex items-center gap-4 cursor-pointer">
          <Avatar className="w-11 h-11">
            <AvatarImage src={currentUser.avatar} />
            <AvatarFallback>{currentUser.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{currentUser.username}</span>
            <span className="text-sm text-muted-foreground">{currentUser.name}</span>
          </div>
        </Link>
        <button className="text-xs font-semibold text-primary hover:text-primary/80">
          Chuyển
        </button>
      </div>

      {/* Suggestions Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-muted-foreground">
          Gợi ý cho bạn
        </span>
        <Link to="/explore/people" className="text-xs font-semibold hover:text-muted-foreground">
          Xem tất cả
        </Link>
      </div>

      {/* Suggestion List */}
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          suggestions.map((user: any) => (
            <SidebarSuggestionItem key={user.id} user={user} />
          ))
        )}
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
