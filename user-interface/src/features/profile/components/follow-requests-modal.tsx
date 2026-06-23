import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  getRelationsControllerGetPendingRequestsQueryKey,
  useRelationsControllerGetPendingRequests,
} from '@/services/apis/gen/queries';
import { QueryKey, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, UserPlus } from 'lucide-react';
import { orvalClient } from '@/services/apis/axios-client';
import { getAvatarUrl } from '@/utils/user';

interface FollowRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FollowRequestsModal({ open, onOpenChange }: FollowRequestsModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: requestsData, isLoading, isError } = useRelationsControllerGetPendingRequests(
    undefined,
    {
      query: {
        enabled: open,
      },
    }
  );

  const pageData =
    (requestsData as any)?.data?.data ||
    (requestsData as any)?.data ||
    requestsData ||
    {};
  const requests = Array.isArray(pageData)
    ? pageData
    : Array.isArray((pageData as any).data)
      ? (pageData as any).data
      : [];

  const removeRequestFromCache = (userId: string) => {
    queryClient.setQueriesData(
      {
        predicate: (query) =>
          query.queryKey[0] === '/relations/requests/pending',
      },
      (old: any) => {
        if (old?.data?.data?.data) {
          const nextList = old.data.data.data.filter(
            (item: any) => item.user?.id !== userId,
          );
          return {
            ...old,
            data: {
              ...old.data,
              data: {
                ...old.data.data,
                total: Math.max(0, (old.data.data.total || 0) - 1),
                data: nextList,
              },
            },
          };
        }
        if (Array.isArray(old?.data?.data)) {
          const nextList = old.data.data.filter(
            (item: any) => item.user?.id !== userId,
          );
          return {
            ...old,
            data: {
              ...old.data,
              total: Math.max(0, (old.data.total || 0) - 1),
              data: nextList,
            },
          };
        }
        if (Array.isArray(old?.data)) {
          return {
            ...old,
            data: old.data.filter((item: any) => item.user?.id !== userId),
          };
        }
        if (Array.isArray(old)) {
          return old.filter((item: any) => item.user?.id !== userId);
        }
        return old;
      },
    );
  };

  const snapshotRequests = () =>
    queryClient.getQueriesData({
      predicate: (query) =>
        query.queryKey[0] === '/relations/requests/pending',
    });

  const restoreRequests = (snapshots?: Array<[QueryKey, unknown]>) => {
    snapshots?.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
  };

  const { mutate: acceptRequest, isPending: isAccepting } = useMutation({
    mutationFn: (userId: string) =>
      orvalClient({ url: '/relations/requests/accept', method: 'POST', data: { user_id: userId } }),
    onMutate: (userId) => {
      const snapshots = snapshotRequests();
      removeRequestFromCache(userId);
      return { snapshots };
    },
    onError: (_error, _userId, context) => {
      restoreRequests(context?.snapshots);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRelationsControllerGetPendingRequestsQueryKey(),
      });
    },
  });

  const { mutate: rejectRequest, isPending: isRejecting } = useMutation({
    mutationFn: (userId: string) =>
      orvalClient({ url: '/relations/requests/reject', method: 'POST', data: { user_id: userId } }),
    onMutate: (userId) => {
      const snapshots = snapshotRequests();
      removeRequestFromCache(userId);
      return { snapshots };
    },
    onError: (_error, _userId, context) => {
      restoreRequests(context?.snapshots);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRelationsControllerGetPendingRequestsQueryKey(),
      });
    },
  });

  const handleAccept = (userId: string) => {
    acceptRequest(userId);
  };

  const handleReject = (userId: string) => {
    rejectRequest(userId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background text-foreground border-border rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-center font-bold">Yêu cầu theo dõi</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive flex flex-col items-center">
              <AlertCircle className="w-10 h-10 mb-3 opacity-70" />
              <p>Không thể tải danh sách yêu cầu</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
              <UserPlus className="w-12 h-12 mb-3 opacity-20" />
              <p>Không có yêu cầu nào</p>
            </div>
          ) : (
            requests.map((req: any) => {
              const requester = req.user;
              if (!requester) return null;

              return (
                <div key={req.id} className="flex items-center justify-between gap-3">
                  <div
                    onClick={() => {
                      onOpenChange(false);
                      setTimeout(() => {
                        navigate(`/profile/${requester.id}`);
                      }, 100);
                    }}
                    className="flex items-center gap-3 flex-1 overflow-hidden cursor-pointer"
                  >
                    <Avatar className="w-11 h-11 border border-border">
                      <AvatarImage src={getAvatarUrl(requester.avatar || requester.avatar_url)} />
                      <AvatarFallback>
                        {requester.username?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold text-sm truncate hover:underline">
                        {requester.username}
                      </span>
                      <span className="text-muted-foreground text-[13px] truncate">
                        {requester.full_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
                      onClick={() => handleAccept(requester.id)}
                      disabled={isAccepting || isRejecting}
                    >
                      Xác nhận
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-secondary hover:bg-secondary/80 font-semibold px-4"
                      onClick={() => handleReject(requester.id)}
                      disabled={isAccepting || isRejecting}
                    >
                      Xóa
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
