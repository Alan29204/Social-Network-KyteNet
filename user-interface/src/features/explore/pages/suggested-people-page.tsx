import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useRelationsControllerGetSuggestedUsers } from '@/services/apis/gen/queries';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFollowAction } from '@/features/profile/hooks/use-follow-action';
import { getAvatarUrl, getDisplayName } from '@/utils/user';

function SuggestedUserItem({ user }: { user: any }) {
  const followAction = useFollowAction(user);
  const mutualCount = user.mutual_count || 0;
  const mutualFriends = user.mutual_friends || [];
  
  let infoText = 'Gợi ý cho bạn';
  if (mutualCount === 1 && mutualFriends.length > 0) {
    infoText = `Có ${mutualFriends[0].username} theo dõi`;
  } else if (mutualCount > 1 && mutualFriends.length > 0) {
    infoText = `Có ${mutualFriends[0].username} và ${mutualCount - 1} người khác theo dõi`;
  }

  return (
    <div className="flex items-center justify-between">
      <Link to={`/profile/${user.id}`} className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 p-2 rounded-xl transition-colors flex-1 min-w-0 mr-4">
        <div className="relative shrink-0">
          <Avatar className="w-12 h-12">
            <AvatarImage src={getAvatarUrl(user.avatar)} />
            <AvatarFallback className="bg-secondary text-sm uppercase">
              {(user.username || 'U').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {mutualFriends.length > 0 && (
            <Avatar className="w-5 h-5 absolute -bottom-1 -right-1 ring-2 ring-background">
              <AvatarImage src={getAvatarUrl(mutualFriends[0].avatar)} />
              <AvatarFallback className="text-[10px] uppercase">
                {mutualFriends[0].username[0]}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <div className="flex flex-col flex-1 min-w-0 justify-center">
          <span className="text-sm font-semibold truncate">{getDisplayName(user)}</span>
          <span className="text-sm text-muted-foreground truncate">{user.username ? `@${user.username}` : ''}</span>
          <span className="text-[13px] text-muted-foreground truncate mt-0.5" title={infoText}>
            {infoText}
          </span>
        </div>
      </Link>
      <div className="shrink-0">
        <Button 
          size="sm" 
          onClick={followAction.toggleFollow}
          disabled={followAction.isMutating || followAction.isBlocked}
          variant={followAction.isFollowing || followAction.isPendingFollow ? "secondary" : "default"}
          className={
            followAction.isFollowing || followAction.isPendingFollow
              ? "px-6 rounded-lg font-semibold min-w-[100px]" 
              : "px-6 rounded-lg font-semibold bg-[#0095f6] hover:bg-[#1877f2] text-white min-w-[100px]"
          }
        >
          {followAction.isPendingFollow
            ? 'Đã gửi yêu cầu'
            : followAction.isFollowing
              ? 'Đang theo dõi'
              : 'Theo dõi'}
        </Button>
      </div>
    </div>
  );
}

export default function SuggestedPeoplePage() {
  const { data: suggestedRes, isLoading } = useRelationsControllerGetSuggestedUsers({ limit: 30 });
  const rawSuggestions = (suggestedRes as any)?.data?.data || (suggestedRes as any)?.data || [];
  const suggestions = Array.isArray(rawSuggestions) ? rawSuggestions : [];

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
