import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/stores/auth-store';
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

interface FollowersModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FollowersModal({ userId, isOpen, onClose }: FollowersModalProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isMe = currentUser?.id === userId;
  const { ref, inView } = useInView();
  
  // Track removed followers locally to show "Đã xóa" without removing from DOM
  const [removedFollowers, setRemovedFollowers] = useState<Set<string>>(new Set());
  
  // Confirmation dialog state
  const [confirmUser, setConfirmUser] = useState<any>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['followers', userId],
      queryFn: ({ pageParam = 1 }) =>
        orvalClient<any>({
          url: `/relations/friends/${userId}?relation=following&mode=followers&page=${pageParam}&limit=20`,
          method: 'GET',
        }),
      getNextPageParam: (lastPage) => {
        const meta = lastPage?.data || lastPage;
        if (meta.page < Math.ceil(meta.total / meta.limit)) {
          return meta.page + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
      enabled: isOpen,
    });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  const removeFollowerMutation = useMutation({
    mutationFn: (followerId: string) =>
      orvalClient({ url: `/relations/follower/${followerId}`, method: 'DELETE' }),
    onSuccess: (_, followerId) => {
      setRemovedFollowers(prev => new Set(prev).add(followerId));
      setConfirmUser(null);
      
      // Optimistic update for followers count in profile
      queryClient.setQueryData(['profile', userId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          followersCount: Math.max(0, (oldData.followersCount || 0) - 1),
        };
      });
    },
  });

  const confirmRemove = () => {
    if (confirmUser) {
      removeFollowerMutation.mutate(confirmUser.id);
    }
  };

  const handleCloseModal = () => {
    onClose();
    setTimeout(() => setRemovedFollowers(new Set()), 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center border-b pb-4">Người theo dõi</DialogTitle>
        </DialogHeader>
        <div className="p-2 relative">
          <Search className="w-4 h-4 absolute left-4 top-5 text-muted-foreground" />
          <Input placeholder="Tìm kiếm" className="pl-8 bg-muted/50 border-none" />
        </div>
        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto mt-2 pb-4">
          {status === 'pending' ? (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : status === 'error' ? (
            <div className="text-center text-sm text-destructive py-4">Lỗi tải danh sách</div>
          ) : (
            <>
              {data.pages.map((page, i) => (
                <div key={i} className="flex flex-col gap-4">
                  {(page.data?.data || page.data || []).map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border border-border">
                          <AvatarImage src={f.user?.avatar || '/default-avatar.png'} className="object-cover" />
                          <AvatarFallback>{f.user?.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-sm">
                          <span className="font-semibold">{f.user?.username}</span>
                          <span className="text-muted-foreground">{f.user?.email}</span>
                        </div>
                      </div>
                      {isMe && (
                        removedFollowers.has(f.user?.id) ? (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            disabled
                            className="bg-muted text-muted-foreground opacity-70"
                          >
                            Đã xóa
                          </Button>
                        ) : (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => setConfirmUser(f.user)}
                          >
                            Xóa
                          </Button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <div ref={ref} className="py-2 flex justify-center">
                {isFetchingNextPage && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
              </div>
            </>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={!!confirmUser} onOpenChange={() => setConfirmUser(null)}>
        <AlertDialogContent className="sm:max-w-[400px] flex flex-col items-center text-center p-6">
          {confirmUser && (
            <Avatar className="w-20 h-20 mb-2">
              <AvatarImage src={confirmUser.avatar || '/default-avatar.png'} className="object-cover" />
              <AvatarFallback>{confirmUser.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          <AlertDialogHeader className="flex flex-col items-center text-center w-full">
            <AlertDialogTitle className="text-xl">Xóa người theo dõi?</AlertDialogTitle>
            <AlertDialogDescription className="text-center w-full px-4">
              Instagram sẽ không cho {confirmUser?.username} biết rằng bạn đã xóa họ khỏi danh sách người theo dõi mình.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col w-full sm:flex-col sm:space-x-0 mt-6 gap-2 border-t pt-4">
            <AlertDialogAction 
              onClick={confirmRemove}
              className="w-full bg-transparent text-destructive hover:bg-muted text-base font-bold shadow-none"
              disabled={removeFollowerMutation.isPending}
            >
              {removeFollowerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full border-none shadow-none mt-0 text-base">Hủy</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
