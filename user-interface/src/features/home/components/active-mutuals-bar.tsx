import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { getAvatarUrl, getDisplayName } from '@/utils/user';

interface ActiveMutual {
  id: string;
  username: string;
  full_name?: string;
  avatar?: string;
}

/** Lấy mutual (theo dõi lẫn nhau) đang online. */
function useActiveMutuals() {
  return useQuery({
    queryKey: ['active-mutuals'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get('/relations/active-mutuals', {
        params: { limit: 10 },
      });
      return (res.data?.data ?? res.data ?? []) as ActiveMutual[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // cập nhật trạng thái online định kỳ
  });
}

/**
 * Dãy avatar đầu feed: hiển thị mutual đang online (tối đa 10, không gồm bản thân).
 * Không có ai online → hiển thị các hình tròn rỗng làm placeholder.
 */
export function ActiveMutualsBar() {
  const { data: mutuals = [], isLoading } = useActiveMutuals();

  return (
    <div className="px-4 sm:px-0 mb-4">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-[72px] h-[72px] rounded-full bg-secondary animate-pulse" />
              <div className="w-12 h-2 rounded bg-secondary animate-pulse" />
            </div>
          ))
        ) : mutuals.length === 0 ? (
          // Không có mutual nào online → hình tròn rỗng
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-[72px] h-[72px] rounded-full border-2 border-dashed border-border bg-muted/30" />
              <div className="w-12 h-2 rounded bg-muted/40" />
            </div>
          ))
        ) : (
          mutuals.map((u) => (
            <Link
              key={u.id}
              to={`/profile/${u.id}`}
              className="flex flex-col items-center gap-1 shrink-0 w-[72px]"
            >
              <div className="relative">
                <div className="w-[72px] h-[72px] rounded-full p-[3px] bg-gradient-to-br from-kyte-blue to-kyte-coral">
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                    <Avatar className="w-[66px] h-[66px]">
                      <AvatarImage
                        src={getAvatarUrl(u.avatar)}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-muted" />
                    </Avatar>
                  </div>
                </div>
                {/* Chấm xanh online */}
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background" />
              </div>
              <span className="text-[10px] text-muted-foreground max-w-[72px] truncate px-1">
                {getDisplayName(u)}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
