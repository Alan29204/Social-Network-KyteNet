import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Settings, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { FollowersModal } from './followers-modal';
import { FollowingModal } from './following-modal';
import { AvatarUploadModal } from './avatar-upload-modal';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/auth-store';

interface ProfileHeaderProps {
  user: {
    id: string;
    email: string;
    avatar?: string;
    username: string;
    bio?: string;
    postsCount?: number;
    followersCount?: number;
    followingCount?: number;
  };
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const { user: authUser } = useAuthStore();
  const isMe = authUser?.id === user.id;
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
      <div className="flex-shrink-0">
        <button 
          onClick={() => isMe && setShowAvatarModal(true)} 
          className={isMe ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
        >
          <Avatar className="w-32 h-32 md:w-40 md:h-40 border">
            <AvatarImage src={user?.avatar || '/default-avatar.png'} alt={user?.username} className="object-cover" />
            <AvatarFallback>{user?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
        </button>
      </div>
      
      <div className="flex-grow flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <h1 className="text-2xl font-semibold">{user.username}</h1>
          <div className="flex gap-2">
            {isMe ? (
              <>
                <Link to="/profile/edit">
                  <Button variant="secondary" size="sm">Chỉnh sửa trang cá nhân</Button>
                </Link>
                <Button variant="secondary" size="sm">Xem kho lưu trữ</Button>
                <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
              </>
            ) : (
              <>
                <Button variant="default" size="sm">Theo dõi</Button>
                <Button variant="secondary" size="sm" className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Nhắn tin
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-6 justify-center md:justify-start">
          <div className="text-center md:text-left">
            <span className="font-semibold">{user.postsCount || 0}</span> bài viết
          </div>
          <button className="text-center md:text-left hover:underline" onClick={() => setShowFollowers(true)}>
            <span className="font-semibold">{user.followersCount || 0}</span> người theo dõi
          </button>
          <button className="text-center md:text-left hover:underline" onClick={() => setShowFollowing(true)}>
            <span className="font-semibold">{user.followingCount || 0}</span> đang theo dõi
          </button>
        </div>

        <div>
          <p className="font-semibold">{user.username}</p>
          {user.bio && <p className="whitespace-pre-wrap mt-1">{user.bio}</p>}
        </div>
      </div>
      
      <FollowersModal 
        userId={user.id} 
        isOpen={showFollowers} 
        onClose={() => setShowFollowers(false)} 
      />
      <FollowingModal 
        userId={user.id} 
        isOpen={showFollowing} 
        onClose={() => setShowFollowing(false)} 
      />

      <AvatarUploadModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentAvatar={user?.avatar}
      />
    </div>
  );
}
