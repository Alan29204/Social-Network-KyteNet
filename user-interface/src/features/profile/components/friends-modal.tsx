import { useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { useFollowAction } from '@/features/profile/hooks/use-follow-action';
import { getAvatarUrl, getDisplayName } from '@/utils/user';

interface MutualFriend {
  id: string;
  username: string;
  full_name?: string;
  avatar?: string;
  privacy?: string;
}

/** Một dòng bạn bè: avatar + tên + nút "Đang theo dõi" (bấm -> xác nhận hủy). */
function FriendRow({ user, onClose }: { user: MutualFriend; onClose: () => void }) {
  const follow = useFollowAction({ ...user, isFollowing: true });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <div className="flex items-center justify-between px-1 py-2">
      <Link
        to={`/profile/${user.id}`}
        onClick={onClose}
        className="flex items-center gap-3 min-w-0 flex-1 mr-2"
      >
        <Avatar className="w-11 h-11 ring-2 ring-kyte-blue/10">
          <AvatarImage src={getAvatarUrl(user.avatar)} className="object-cover" />
          <AvatarFallback className="bg-muted" />
        </Avatar>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">
            {getDisplayName(user)}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            @{user.username}
          </span>
        </div>
      </Link>

      <button
        onClick={() => setConfirmOpen(true)}
        disabled={follow.isMutating}
        className={
          follow.isFollowing
            ? 'text-xs font-semibold text-muted-foreground shrink-0 px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-all disabled:opacity-60'
            : 'text-xs font-semibold text-white shrink-0 px-4 py-1.5 rounded-full bg-gradient-to-r from-kyte-blue to-kyte-coral hover:opacity-90 transition-all disabled:opacity-60'
        }
      >
        {follow.isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hủy theo dõi ${getDisplayName(user)}?`}
        description="Hai bạn sẽ không còn là bạn bè (theo dõi lẫn nhau) nữa."
        confirmText="Hủy theo dõi"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          follow.toggleFollow();
          // Cập nhật lại danh sách bạn bè (mutual) sau khi hủy theo dõi.
          setTimeout(
            () =>
              queryClient.invalidateQueries({ queryKey: ['mutual-friends'] }),
            600,
          );
        }}
      />
    </div>
  );
}

interface FriendsModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

/** Modal danh sách bạn bè (mutual — theo dõi lẫn nhau). Chỉ chủ tài khoản mở. */
export function FriendsModal({ userId, isOpen, onClose }: FriendsModalProps) {
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['mutual-friends', userId],
      queryFn: ({ pageParam = 1 }) =>
        AXIOS_INSTANCE.get(`/relations/mutuals/${userId}`, {
          params: { page: pageParam, limit: 20 },
        }).then((r) => r.data),
      getNextPageParam: (lastPage: any) => {
        const meta = lastPage?.data?.meta || lastPage?.meta;
        if (meta && meta.page < meta.total_pages) return meta.page + 1;
        return undefined;
      },
      initialPageParam: 1,
      enabled: isOpen && !!userId,
      staleTime: 60_000,
    });

  const friends: MutualFriend[] =
    data?.pages.flatMap((p: any) => p?.data?.data || p?.data || []) || [];
  const total: number =
    (data?.pages?.[0] as any)?.data?.meta?.total ?? friends.length;

  useEffect(() => {
    if (inView && hasNextPage) fetchNextPage();
  }, [inView, hasNextPage, fetchNextPage]);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center border-b pb-4">
            {total} người bạn
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col max-h-[420px] overflow-y-auto pb-2">
          {status === 'pending' ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <span className="text-sm text-muted-foreground">
                Chưa có bạn bè nào
              </span>
            </div>
          ) : (
            <>
              {friends.map((u) => (
                <FriendRow key={u.id} user={u} onClose={onClose} />
              ))}
              <div ref={ref} className="py-2 flex justify-center">
                {isFetchingNextPage && (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
