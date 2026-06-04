import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { PostDetailModal } from '@/features/posts/components/post-detail-modal';
import { Loader2 } from 'lucide-react';

export default function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: postData, isLoading, isError } = useQuery({
    queryKey: ['postDetail', id],
    queryFn: () => orvalClient<any>({ url: `/posts/${id}`, method: 'GET' }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !postData?.data) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Bài viết không tồn tại hoặc đã bị xóa.</p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <PostDetailModal
        post={postData.data}
        open={true}
        onOpenChange={(open) => {
          if (!open) navigate('/');
        }}
      />
    </div>
  );
}
