import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { Bookmark, FolderPlus } from 'lucide-react';
import { CreateSaveListModal } from '@/features/saved/components/create-save-list-modal';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export function SavedCollections({ userId: _userId }: { userId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  // Danh sách bộ sưu tập
  const { data: lists, isLoading: loadingLists } = useQuery({
    queryKey: ['save-lists'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get('/save-lists', {
        params: { page: 1, limit: 100 },
      });
      const payload = res?.data?.data ?? res?.data;
      return (payload?.data ?? payload ?? []) as { id: string; name: string }[];
    },
  });

  // Tất cả bài đã lưu (để lấy ảnh thumbnail)
  const { data: savedPosts, isLoading: loadingPosts } = useQuery({
    queryKey: ['saved-posts'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get('/save-posts/me/list', {
        params: { page: 1, limit: 50 },
      });
      const payload = res?.data?.data ?? res?.data;
      return (payload?.data ?? payload ?? []) as any[];
    },
  });

  const isLoading = loadingLists || loadingPosts;

  const getFirstMedia = (): string | null => {
    const posts = savedPosts || [];
    for (const p of posts) {
      const medias = p.medias || p.post?.medias || [];
      if (Array.isArray(medias) && medias.length > 0) return medias[0];
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-4">
        {/* Nút tạo bộ sưu tập mới */}
        <button
          onClick={() => setCreateOpen(true)}
          className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:bg-muted/50 transition-colors"
        >
          <FolderPlus className="w-8 h-8 text-muted-foreground mb-2" />
          <span className="text-sm font-medium text-muted-foreground">
            Tạo bộ sưu tập mới
          </span>
        </button>

        {/* Bộ sưu tập "Tất cả bài đã lưu" */}
        <div 
          className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer border bg-muted"
          onClick={() => navigate('/saved')}
        >
          {getFirstMedia() ? (
            <img
              src={getFirstMedia()!}
              alt="Đã lưu"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Bookmark className="w-10 h-10 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
          <div className="absolute bottom-3 left-3 z-20 text-white font-medium">
            Tất cả ({savedPosts?.length || 0})
          </div>
        </div>

        {/* Các bộ sưu tập của user */}
        {(lists || []).map((list) => (
          <div
            key={list.id}
            className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer border bg-muted"
            onClick={() => navigate(`/saved?listId=${list.id}&name=${encodeURIComponent(list.name)}`)}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <Bookmark className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
            <div className="absolute bottom-3 left-3 z-20 text-white font-medium truncate max-w-[80%]">
              {list.name}
            </div>
          </div>
        ))}
      </div>

      <CreateSaveListModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
