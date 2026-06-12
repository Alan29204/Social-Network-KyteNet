import { useParams } from 'react-router-dom';
import { ProfileHeader } from '../components/profile-header';
import { ProfileTabs } from '../components/profile-tabs';
import { ProfileSkeleton } from '../components/profile-skeleton';
import { useQuery } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();

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
          privacy: string;
          bio?: string;
          postsCount?: number;
          followersCount?: number;
          followingCount?: number;
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
    return <div className="text-center p-8 text-destructive">Error loading profile</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <ProfileHeader user={userProfile} />
      <div className="mt-8 border-t">
        <ProfileTabs userId={userProfile.id} />
      </div>
    </div>
  );
}
