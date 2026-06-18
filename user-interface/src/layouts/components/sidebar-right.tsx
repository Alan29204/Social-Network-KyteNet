import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Link } from 'react-router-dom';
import { useRelationsControllerGetSuggestedUsers } from '@/services/apis/gen/queries';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useState, useRef } from 'react';
import { getDisplayName, getAvatarUrl } from '@/utils/user';

function SidebarSuggestionItem({ user }: { user: any }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutualCount = user.mutual_count || 0;
  const mutualFriends = user.mutual_friends || [];

  let infoText = 'Gợi ý cho bạn';
  if (mutualCount === 1 && mutualFriends.length > 0) {
    infoText = `Được theo dõi bởi ${mutualFriends[0].username}`;
  } else if (mutualCount > 1 && mutualFriends.length > 0) {
    infoText = `Được theo dõi bởi ${mutualFriends[0].username} và ${mutualCount - 1} người khác`;
  }

  const toggleFollowMutation = useMutation({
    mutationFn: (action: 'following' | 'none') =>
      orvalClient({
        url: '/relations/update',
        method: 'POST',
        data: { user_id: user.id, relation: action },
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
    <div className="flex items-center justify-between group">
      <Link
        to={`/profile/${user.id}`}
        className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 mr-2"
      >
        <div className="relative shrink-0">
          <Avatar className="w-10 h-10 ring-2 ring-snet-purple/10 transition-all group-hover:ring-snet-purple/30">
            <AvatarImage
              src={getAvatarUrl(user.avatar)}
              className="object-cover"
            />
            <AvatarFallback className="bg-muted" />
          </Avatar>
          {mutualFriends.length > 0 && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <Avatar className="w-4 h-4 ring-[1.5px] ring-background">
                <AvatarImage
                  src={getAvatarUrl(mutualFriends[0].avatar)}
                />
                <AvatarFallback className="bg-muted" />
              </Avatar>
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">
            {getDisplayName(user)}
          </span>
          <span
            className="text-xs text-muted-foreground truncate"
            title={infoText}
          >
            {infoText}
          </span>
        </div>
      </Link>
      <button
        onClick={handleToggleFollow}
        className={
          isFollowing
            ? 'text-xs font-semibold text-muted-foreground hover:text-muted-foreground/80 shrink-0 px-3 py-1 rounded-full border border-border hover:bg-secondary transition-all'
            : 'text-xs font-semibold text-white shrink-0 px-4 py-1 rounded-full bg-gradient-to-r from-snet-purple to-snet-pink hover:opacity-90 shadow-sm shadow-snet-purple/20 transition-all'
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
    username: getDisplayName(authUser),
    name: authUser?.username ? `@${authUser.username}` : '',
    avatar: authUser?.avatar,
  };

  const { data: suggestedRes, isLoading } =
    useRelationsControllerGetSuggestedUsers({ limit: 5 });
  const suggestions = Array.isArray(suggestedRes?.data)
    ? suggestedRes.data
    : [];

  return (
    <aside className="hidden lg:flex flex-col w-full pt-0 px-4 h-full animate-fade-in">
      {/* Current User Card */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-4 mb-6 card-hover">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-snet-purple via-snet-pink to-snet-blue" />

        <Link
          to={`/profile/${currentUser.id}`}
          className="flex items-center gap-4 cursor-pointer"
        >
          <div className="relative">
            <Avatar className="w-12 h-12 ring-2 ring-snet-purple/20">
              <AvatarImage src={getAvatarUrl(currentUser.avatar)} className="object-cover" />
              <AvatarFallback className="bg-muted" />
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-card rounded-full" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-bold truncate">
              {currentUser.username}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {currentUser.name}
            </span>
          </div>
        </Link>
      </div>

      {/* Suggestions Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-snet-purple/10 to-snet-pink/10 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-snet-purple" />
          </div>
          <span className="text-sm font-bold text-foreground">
            Gợi ý cho bạn
          </span>
        </div>
        <Link
          to="/explore/people"
          className="text-xs font-semibold text-snet-purple hover:text-snet-pink transition-colors"
        >
          Xem tất cả
        </Link>
      </div>

      {/* Suggestion List */}
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-snet-purple" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <UserPlus className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <span className="text-sm text-muted-foreground">
              Chưa có gợi ý nào
            </span>
          </div>
        ) : (
          suggestions.map((user: any) => (
            <SidebarSuggestionItem key={user.id} user={user} />
          ))
        )}
      </div>

      {/* Footer Links */}
      <div className="mt-auto pt-6 pb-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {['Giới thiệu', 'Trợ giúp', 'Bảo mật', 'Điều khoản', 'API'].map(
            (link) => (
              <button
                key={link}
                className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                {link}
              </button>
            ),
          )}
        </div>
        <span className="text-[11px] text-muted-foreground/40 mt-2 block">
          © 2026 SNet Social Network
        </span>
      </div>
    </aside>
  );
}
