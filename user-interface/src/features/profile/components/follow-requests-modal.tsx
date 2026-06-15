import React from 'react';
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
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { orvalClient } from '@/services/apis/axios-client';

interface FollowRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FollowRequestsModal({ open, onOpenChange }: FollowRequestsModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: requestsData, isLoading } = useRelationsControllerGetPendingRequests({
    query: {
      enabled: open,
    },
  });

  console.log('requestsData:', requestsData);
  const rawData = (requestsData as any)?.data?.data || (requestsData as any)?.data || requestsData;
  const requests = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.data) ? rawData.data : []);

  const { mutate: acceptRequest, isPending: isAccepting } = useMutation({
    mutationFn: (userId: string) =>
      orvalClient({ url: '/relations/requests/accept', method: 'POST', data: { user_id: userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRelationsControllerGetPendingRequestsQueryKey(),
      });
    },
  });

  const { mutate: rejectRequest, isPending: isRejecting } = useMutation({
    mutationFn: (userId: string) =>
      orvalClient({ url: '/relations/requests/reject', method: 'POST', data: { user_id: userId } }),
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
                      <AvatarImage src={requester.avatar || requester.avatar_url || ''} />
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
