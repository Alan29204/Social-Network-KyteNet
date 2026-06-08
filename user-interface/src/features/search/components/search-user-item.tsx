import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

interface SearchUserItemProps {
  user: {
    id: string;
    username?: string;
    email?: string;
    avatar?: string;
    full_name?: string;
  };
  onNavigate?: () => void;
}

/**
 * Một dòng kết quả người dùng trong trang tìm kiếm.
 */
export function SearchUserItem({ user, onNavigate }: SearchUserItemProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    onNavigate?.();
    navigate(`/profile/${user.id}`);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
    >
      <Avatar className="w-11 h-11 shrink-0">
        <AvatarImage
          src={user.avatar || '/default-avatar.png'}
          alt={user.username}
          className="object-cover"
        />
        <AvatarFallback>
          {user.username?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-sm truncate">
          {user.username || 'Người dùng'}
        </span>
        <span className="text-muted-foreground text-xs truncate">
          {user.full_name || user.email || ''}
        </span>
      </div>
    </button>
  );
}
