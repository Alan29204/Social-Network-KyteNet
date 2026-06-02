import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useRelationsControllerGetSuggestedUsers } from '@/services/apis/gen/queries';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useState, useRef } from 'react';

function SuggestedUserItem({ user }: { user: any }) {
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
      <Link to={`/profile/${user.id}`} className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 p-2 rounded-xl transition-colors flex-1 min-w-0 mr-4">
        <div className="relative shrink-0">
          <Avatar className="w-12 h-12">
            <AvatarImage src={user.avatar || '/default-avatar.png'} />
            <AvatarFallback className="bg-secondary text-sm uppercase">
              {user.username.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          {mutualFriends.length > 0 && (
            <Avatar className="w-5 h-5 absolute -bottom-1 -right-1 ring-2 ring-background">
              <AvatarImage src={mutualFriends[0].avatar || '/default-avatar.png'} />
              <AvatarFallback className="text-[10px] uppercase">
                {mutualFriends[0].username[0]}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <div className="flex flex-col flex-1 min-w-0 justify-center">
          <span className="text-sm font-semibold truncate">{user.username}</span>
          <span className="text-sm text-muted-foreground truncate">{user.fullname || user.username}</span>
          <span className="text-[13px] text-muted-foreground truncate mt-0.5" title={infoText}>
            {infoText}
          </span>
        </div>
      </Link>
      <div className="shrink-0">
        <Button 
          size="sm" 
          onClick={handleToggleFollow}
          variant={isFollowing ? "secondary" : "default"}
          className={
            isFollowing 
              ? "px-6 rounded-lg font-semibold min-w-[100px]" 
              : "px-6 rounded-lg font-semibold bg-[#0095f6] hover:bg-[#1877f2] text-white min-w-[100px]"
          }
        >
          {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
        </Button>
      </div>
    </div>
  );
}

export default function SuggestedPeoplePage() {
  const { data: suggestedRes, isLoading } = useRelationsControllerGetSuggestedUsers({ limit: 30 });
  const suggestions = Array.isArray(suggestedRes?.data) ? suggestedRes.data : [];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 w-full h-full min-h-screen">
      <h1 className="text-xl font-bold mb-6">Gợi ý</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {suggestions.map((user: any) => (
            <SuggestedUserItem key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}
