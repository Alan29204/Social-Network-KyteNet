import { useParams } from 'react-router-dom';
import { ProfileHeader } from '../components/profile-header';
import { ProfileTabs } from '../components/profile-tabs';
import { ProfileSkeleton } from '../components/profile-skeleton';
import { useQuery } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Lock } from 'lucide-react';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuthStore();

  const { data: userProfile, isLoading, error } = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      // Temporary manual call since orval gen hasn't run yet
      const response = await orvalClient<{
        data: {
          id: string;
          email: string;
          avatar: string;
          username: string;
          full_name?: string;
          privacy: string;
          bio?: string;
          postsCount?: number;
          followersCount?: number;
          followingCount?: number;
          isFollowing?: boolean;
        }
      }>({
        method: 'GET',
        url: `/users/${id}`,
      });
      return response.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !userProfile) {
    const is404 = (error as any)?.response?.status === 404 || (error as any)?.response?.status === 403;
    if (is404) {
      return (
        <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 relative">
            <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden bg-muted" />
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 px-4 sm:px-8 -mt-16 md:-mt-20 relative z-10">
              <div className="flex-shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background bg-muted overflow-hidden flex items-center justify-center">
                  <img src="/default-avatar.png" alt="default" className="w-full h-full object-cover opacity-50" />
                </div>
              </div>
              <div className="flex-grow flex flex-col gap-4 mt-2 md:mt-20">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <h1 className="text-2xl font-semibold">Người dùng</h1>
                  <button className="px-4 py-1.5 bg-muted text-muted-foreground font-semibold rounded-lg cursor-not-allowed" disabled>
                    Không có hành động khả dụng
                  </button>
                </div>
                <div className="flex gap-6 justify-center md:justify-start">
                  <div className="text-center md:text-left"><span className="font-semibold">-</span> bài viết</div>
                  <div className="text-center md:text-left"><span className="font-semibold">-</span> người theo dõi</div>
                  <div className="text-center md:text-left"><span className="font-semibold">-</span> đang theo dõi</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-16 border-t pt-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 border-2 border-foreground rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">🚫</span>
            </div>
            <h2 className="text-2xl font-bold mb-4">Trang này không khả dụng.</h2>
            <p className="text-muted-foreground text-lg max-w-md">
              Liên kết bạn theo dõi có thể bị hỏng hoặc trang có thể đã bị xóa.
            </p>
          </div>
        </div>
      );
    }
    return <div className="text-center p-8 text-destructive">Lỗi khi tải trang cá nhân</div>;
  }

  const isMe = authUser?.id === userProfile.id;
  const isPrivateAndNotFollowing = userProfile.privacy === 'private' && !userProfile.isFollowing && !isMe;

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <ProfileHeader user={userProfile as any} />
      
      {isPrivateAndNotFollowing ? (
        <div className="mt-8 border-t pt-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 border-2 border-foreground rounded-full flex items-center justify-center mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Tài khoản này là riêng tư</h2>
          <p className="text-muted-foreground text-lg max-w-md">
            Hãy theo dõi để xem ảnh và video của họ.
          </p>
        </div>
      ) : (
        <div className="mt-8 border-t">
          <ProfileTabs userId={userProfile.id} />
        </div>
      )}
    </div>
  );
}
