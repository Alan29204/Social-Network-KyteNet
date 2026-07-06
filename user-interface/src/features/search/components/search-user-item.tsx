import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { getDisplayName, getAvatarUrl } from '@/utils/user';
import { useFollowAction } from '@/features/profile/hooks/use-follow-action';

interface SearchUserItemProps {
  user: {
    id: string;
    username?: string;
    email?: string;
    avatar?: string;
    full_name?: string;
    relationStatus?: string;
    isFollowing?: boolean;
    isMutual?: boolean;
  };
  onNavigate?: () => void;
}

/**
 * Một dòng kết quả người dùng trong trang tìm kiếm — kèm nhãn quan hệ + nút theo dõi.
 */
export function SearchUserItem({ user, onNavigate }: SearchUserItemProps) {
  const followAction = useFollowAction(user as any);

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors">
      <Link
        to={`/profile/${user.id}`}
        onClick={onNavigate}
        className="flex items-center gap-3 min-w-0 flex-1"
      >
        <Avatar className="w-11 h-11 shrink-0">
          <AvatarImage
            src={getAvatarUrl(user.avatar)}
            alt={getDisplayName(user)}
            className="object-cover"
          />
          <AvatarFallback className="bg-muted" />
        </Avatar>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm truncate">
            {getDisplayName(user)}
          </span>
          <span className="text-muted-foreground text-xs truncate">
            {user.username ? `@${user.username}` : user.email || ''}
            {user.isMutual ? ' · Bạn bè' : ''}
          </span>
        </div>
      </Link>

      <Button
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          followAction.toggleFollow();
        }}
        disabled={followAction.isMutating || followAction.isBlocked}
        variant={
          followAction.isFollowing || followAction.isPendingFollow
            ? 'secondary'
            : 'default'
        }
        className={
          followAction.isFollowing || followAction.isPendingFollow
            ? 'shrink-0 rounded-lg font-semibold text-xs px-4'
            : 'shrink-0 rounded-lg font-semibold text-xs px-4 text-white bg-gradient-to-r from-kyte-blue to-kyte-coral hover:opacity-90'
        }
      >
        {followAction.isPendingFollow
          ? 'Đã gửi'
          : followAction.isFollowing
            ? 'Đang theo dõi'
            : 'Theo dõi'}
      </Button>
    </div>
  );
}
