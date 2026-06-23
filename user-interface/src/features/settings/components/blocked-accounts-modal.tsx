import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRelationsControllerGetBlockedUsersInfinite,
  getRelationsControllerGetBlockedUsersInfiniteQueryKey,
} from '@/services/apis/gen/queries';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useBlockUser } from '@/features/profile/hooks/use-block-user';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { getDisplayName, getAvatarUrl } from '@/utils/user';

interface BlockedAccountsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlockedAccountsModal({
  open,
  onOpenChange,
}: BlockedAccountsModalProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();
  const unblockSnapshotsRef = useRef<Array<[readonly unknown[], unknown]> | null>(
    null,
  );

  const [unblockUserId, setUnblockUserId] = useState<string | null>(null);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useRelationsControllerGetBlockedUsersInfinite(
      { limit: 20 },
      {
        query: {
          enabled: open && !!user,
          getNextPageParam: (lastPage: any) => {
            const pageData = lastPage?.data;
            if (!pageData || !pageData.data) return undefined;
            if (pageData.data.length < pageData.limit) return undefined;
            return pageData.page + 1;
          },
        },
      },
    );

  const { unblockMutation } = useBlockUser();

  const snapshotBlockedUsers = () =>
    queryClient.getQueriesData({
      predicate: (query) =>
        query.queryKey[0] === 'infinite' &&
        query.queryKey[1] === '/relations/blocked/list',
    });

  const removeBlockedUserFromCache = (userId: string) => {
    queryClient.setQueriesData(
      {
        predicate: (query) =>
          query.queryKey[0] === 'infinite' &&
          query.queryKey[1] === '/relations/blocked/list',
      },
      (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => {
            if (Array.isArray(page?.data?.data)) {
              return {
                ...page,
                data: {
                  ...page.data,
                  total: Math.max(0, (page.data.total || 0) - 1),
                  data: page.data.data.filter(
                    (item: any) => item.user?.id !== userId,
                  ),
                },
              };
            }
            if (Array.isArray(page?.data?.data?.data)) {
              return {
                ...page,
                data: {
                  ...page.data,
                  data: {
                    ...page.data.data,
                    total: Math.max(0, (page.data.data.total || 0) - 1),
                    data: page.data.data.data.filter(
                      (item: any) => item.user?.id !== userId,
                    ),
                  },
                },
              };
            }
            return page;
          }),
        };
      },
    );
  };

  const restoreBlockedUsers = () => {
    unblockSnapshotsRef.current?.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
    unblockSnapshotsRef.current = null;
  };

  const handleUnblockConfirmed = () => {
    if (unblockUserId) {
      unblockSnapshotsRef.current = snapshotBlockedUsers();
      removeBlockedUserFromCache(unblockUserId);
      unblockMutation.mutate(unblockUserId, {
        onSuccess: () => {
          setUnblockUserId(null);
          unblockSnapshotsRef.current = null;
          queryClient.invalidateQueries({
            queryKey: getRelationsControllerGetBlockedUsersInfiniteQueryKey(),
          });
        },
        onError: () => {
          restoreBlockedUsers();
          setUnblockUserId(null);
        }
      });
    }
  };

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const blockedUsers =
    data?.pages.flatMap((page: any) => {
      const pageData = page?.data?.data || page?.data || page;
      if (Array.isArray(pageData)) return pageData;
      if (Array.isArray(pageData?.data)) return pageData.data;
      return [];
    }) || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold">
              Tài khoản đã chặn
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col h-[400px] overflow-y-auto mt-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-destructive">
                <AlertCircle className="w-10 h-10 mb-3 opacity-70" />
                <p>Không thể tải danh sách đã chặn.</p>
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <p>Bạn chưa chặn tài khoản nào.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-1">
                {blockedUsers.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Avatar className="w-10 h-10 border border-white/10 shrink-0">
                        <AvatarImage
                          src={getAvatarUrl(item.user?.avatar)}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-muted" />
                      </Avatar>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-sm truncate">
                          {getDisplayName(item.user)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {item.user?.username ? `@${item.user.username}` : ''}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0 font-semibold"
                      onClick={() => setUnblockUserId(item.user?.id)}
                    >
                      Bỏ chặn
                    </Button>
                  </div>
                ))}
                {isFetchingNextPage && (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div ref={ref} className="h-1" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!unblockUserId}
        onOpenChange={(open) => !open && setUnblockUserId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ chặn tài khoản?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn bỏ chặn người dùng này không? Họ sẽ có thể
              xem bài viết của bạn và gửi tin nhắn cho bạn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unblockMutation.isPending}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={unblockMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleUnblockConfirmed();
              }}
            >
              {unblockMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
