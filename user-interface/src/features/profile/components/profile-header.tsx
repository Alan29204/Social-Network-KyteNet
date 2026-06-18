import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Settings,
  MessageCircle,
  Loader2,
  MoreHorizontal,
  Ban,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { FollowersModal } from './followers-modal';
import { FollowingModal } from './following-modal';
import { AvatarUploadModal } from './avatar-upload-modal';
import { CoverUploadModal } from './cover-upload-modal';
import { BlockUserDialog } from './block-user-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getDisplayName, getAvatarUrl } from '@/utils/user';

interface ProfileHeaderProps {
  user: {
    id: string;
    email: string;
    avatar?: string;
    cover_photo?: string | null;
    username: string;
    full_name?: string;
    bio?: string;
    postsCount?: number;
    followersCount?: number;
    followingCount?: number;
    isFollowing?: boolean;
    relationStatus?: string;
  };
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const { user: authUser } = useAuthStore();
  const isMe = authUser?.id === user.id;
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    // Reset image loading state when user changes
    setCoverLoaded(false);
  }, [user.cover_photo]);

  const toggleFollowMutation = useMutation({
    mutationFn: (action: 'following' | 'none') =>
      orvalClient({
        url: '/relations/update',
        method: 'POST',
        data: { user_id: user.id, relation: action },
      }),
    onSuccess: (response: any, action) => {
      setConfirmUnfollow(false);
      
      const returnedStatus = response?.data?.relationStatus || response?.relationStatus;
      
      // Optimistic update for Profile Header stats and isFollowing
      queryClient.setQueryData(['profile', user.id], (oldData: any) => {
        if (!oldData) return oldData;
        
        // If backend returned status, use it. Otherwise fallback to client-side logic.
        let relationStatus = returnedStatus;
        if (!relationStatus) {
            const isNowFollowing = action === 'following';
            const isPrivate = oldData.privacy === 'private';
            const isPending = isPrivate && isNowFollowing;
            relationStatus = isPending ? 'pending' : (isNowFollowing ? 'following' : 'none');
        }
        
        const isFollowing = relationStatus === 'following';
        
        // Only adjust followers count if we actually started following them, or stopped following them.
        let followersDelta = 0;
        if (action === 'following' && relationStatus === 'following') {
            // We started following
            if (!oldData.isFollowing) followersDelta = 1;
        } else if (action === 'none') {
            // We unfollowed
            if (oldData.isFollowing) followersDelta = -1;
        }

        return {
          ...oldData,
          isFollowing,
          relationStatus,
          followersCount: Math.max(0, (oldData.followersCount || 0) + followersDelta),
        };
      });

      // Also update current user's following count if we view our own following list?
      // Just update the profile we are viewing.
    },
  });

  const handleToggleFollow = () => {
    if (user.isFollowing || user.relationStatus === 'pending') {
      setConfirmUnfollow(true);
    } else {
      toggleFollowMutation.mutate('following');
    }
  };

  return (
    <div className="flex flex-col gap-2 relative">
      {/* Cover Photo */}
      <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden bg-muted group">
        {!coverLoaded && (
          <Skeleton className="absolute inset-0 w-full h-full rounded-2xl" />
        )}
        <img
          src={user.cover_photo || '/cafe.jpg'}
          alt="Cover"
          className={`w-full h-full object-cover transition-opacity duration-300 ${coverLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setCoverLoaded(true)}
        />
        {isMe && (
          <div
            className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
            onClick={() => setShowCoverModal(true)}
          >
            <span className="text-white font-semibold bg-black/50 px-4 py-2 rounded-lg">
              Thay đổi ảnh bìa
            </span>
          </div>
        )}
      </div>

      {/* Profile Info Section */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 px-4 sm:px-8 -mt-16 md:-mt-20 relative z-10">
        <div className="flex-shrink-0">
          <button
            onClick={() => isMe && setShowAvatarModal(true)}
            className={
              isMe
                ? 'cursor-pointer hover:opacity-80 transition-opacity'
                : 'cursor-default'
            }
          >
            <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-background bg-background">
              <AvatarImage
                src={getAvatarUrl(user?.avatar)}
                alt={getDisplayName(user)}
                className="object-cover"
              />
              <AvatarFallback className="bg-muted" />
            </Avatar>
          </button>
        </div>

        <div className="flex-grow flex flex-col gap-4 mt-2 md:mt-20">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <h1 className="text-2xl font-semibold">{getDisplayName(user)}</h1>
            <div className="flex gap-2">
              {isMe ? (
                <>
                  <Link to="/profile/edit">
                    <Button variant="secondary" size="sm">
                      Chỉnh sửa trang cá nhân
                    </Button>
                  </Link>
                  <Button variant="secondary" size="sm">
                    Xem kho lưu trữ
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Settings className="w-5 h-5" />
                  </Button>
                </>
              ) : (
                <>
                  {user.isFollowing ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="font-semibold w-[110px]"
                      onClick={handleToggleFollow}
                      disabled={toggleFollowMutation.isPending}
                    >
                      {toggleFollowMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Đang theo dõi'
                      )}
                    </Button>
                  ) : user.relationStatus === 'pending' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="font-semibold w-[110px]"
                      onClick={handleToggleFollow}
                      disabled={toggleFollowMutation.isPending}
                    >
                      {toggleFollowMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Đã yêu cầu'
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white font-semibold w-[110px]"
                      onClick={handleToggleFollow}
                      disabled={toggleFollowMutation.isPending}
                    >
                      {toggleFollowMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Theo dõi'
                      )}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Nhắn tin
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive gap-2"
                        onClick={() => setShowBlockDialog(true)}
                      >
                        <Ban className="w-4 h-4" />
                        Chặn người dùng
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-6 justify-center md:justify-start">
            <div className="text-center md:text-left">
              <span className="font-semibold">{user.postsCount || 0}</span> bài
              viết
            </div>
            <button
              className="text-center md:text-left hover:underline"
              onClick={() => setShowFollowers(true)}
            >
              <span className="font-semibold">{user.followersCount || 0}</span>{' '}
              người theo dõi
            </button>
            <button
              className="text-center md:text-left hover:underline"
              onClick={() => setShowFollowing(true)}
            >
              <span className="font-semibold">{user.followingCount || 0}</span>{' '}
              đang theo dõi
            </button>
          </div>

          <div>
            <p className="font-semibold text-muted-foreground">{user.username ? `@${user.username}` : ''}</p>
            {user.bio && <p className="whitespace-pre-wrap mt-1">{user.bio}</p>}
          </div>
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

      <CoverUploadModal
        isOpen={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        currentCover={user?.cover_photo}
        userId={user.id}
      />

      <BlockUserDialog
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        user={{
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        }}
        mode="block"
      />

      {/* Unfollow Confirmation Modal */}
      <AlertDialog open={confirmUnfollow} onOpenChange={setConfirmUnfollow}>
        <AlertDialogContent className="max-w-[400px] gap-0 p-0 overflow-hidden bg-card border-none rounded-xl">
          <AlertDialogHeader className="text-center p-6 pb-4">
            <div className="flex justify-center mb-4">
              <Avatar className="w-24 h-24 border">
                <AvatarImage
                  src={getAvatarUrl(user.avatar)}
                  className="object-cover"
                />
                <AvatarFallback className="bg-muted" />
              </Avatar>
            </div>
            <AlertDialogTitle className="text-center font-semibold text-lg">
              Bỏ theo dõi @{user.username}?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col items-stretch space-x-0 border-t border-border mt-4 gap-0">
            <AlertDialogAction
              onClick={() => toggleFollowMutation.mutate('none')}
              className="w-full bg-transparent text-destructive hover:bg-muted text-base font-bold shadow-none rounded-none py-4 h-auto border-b border-border"
              disabled={toggleFollowMutation.isPending}
            >
              {toggleFollowMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                `Hủy ${user.relationStatus === 'pending' ? 'yêu cầu' : 'theo dõi'}`
              )}
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setConfirmUnfollow(false)}
              className="w-full bg-transparent hover:bg-muted text-base shadow-none rounded-none border-0 py-4 h-auto m-0"
              disabled={toggleFollowMutation.isPending}
            >
              Hủy
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
