import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import type { StoryGroup, StoryViewer } from './types';

/** Bóc lớp { data, message } của response interceptor backend. */
function unwrap<T>(res: any): T {
  return (res?.data?.data ?? res?.data) as T;
}

export const storyKeys = {
  feed: ['stories', 'feed'] as const,
  viewers: (id: string) => ['stories', 'viewers', id] as const,
};

/** Lấy story feed (bản thân + người đang follow). */
export function useStoryFeed() {
  return useQuery({
    queryKey: storyKeys.feed,
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get('/stories/feed');
      return unwrap<StoryGroup[]>(res) || [];
    },
    staleTime: 60_000,
  });
}

/** Tạo story mới. */
export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      file?: File;
      content?: string;
      background?: string;
      privacy?: string;
    }) => {
      const formData = new FormData();
      if (payload.file) formData.append('media-story', payload.file);
      if (payload.content) formData.append('content', payload.content);
      if (payload.background) formData.append('background', payload.background);
      if (payload.privacy) formData.append('privacy', payload.privacy);

      const res = await AXIOS_INSTANCE.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storyKeys.feed });
    },
  });
}

/** Đánh dấu đã xem story. */
export function useMarkStoryViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      const res = await AXIOS_INSTANCE.post(`/stories/${storyId}/view`);
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storyKeys.feed });
    },
  });
}

/** Xóa story. */
export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      const res = await AXIOS_INSTANCE.delete(`/stories/${storyId}`);
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storyKeys.feed });
    },
  });
}

/** Lấy danh sách người đã xem story (chủ story). */
export function useStoryViewers(storyId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: storyKeys.viewers(storyId || ''),
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get(`/stories/${storyId}/viewers`);
      return unwrap<StoryViewer[]>(res) || [];
    },
    enabled: enabled && !!storyId,
  });
}
