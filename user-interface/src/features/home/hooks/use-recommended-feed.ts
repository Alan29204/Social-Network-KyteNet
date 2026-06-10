import { useQuery } from '@tanstack/react-query';
import AXIOS_INSTANCE from '@/services/apis/axios-client';

export interface RecommendedFeedResponse {
  data: any[];
  meta?: { source?: string; next_cursor: number | null; has_more: boolean };
}

/**
 * Lấy feed gợi ý cá nhân hóa bằng AI (ChromaDB).
 * Gọi trực tiếp endpoint /feed/recommended của core-api (chưa có trong orval gen).
 */
async function fetchRecommendedFeed(
  limit: number,
): Promise<RecommendedFeedResponse> {
  const { data } = await AXIOS_INSTANCE.get('/feed/recommended', {
    params: { limit },
  });
  // core-api bọc response trong { data, message } -> chuẩn hóa
  return data?.data ?? data;
}

export function useRecommendedFeed(limit = 10, enabled = true) {
  return useQuery({
    queryKey: ['feed', 'recommended', limit],
    queryFn: () => fetchRecommendedFeed(limit),
    enabled,
    staleTime: 60_000,
  });
}
