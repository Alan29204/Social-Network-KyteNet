import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FollowingModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FollowingModal({ userId, isOpen, onClose }: FollowingModalProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isMe = currentUser?.id === userId;
  const { ref, inView } = useInView();
  
  // Track unfollowed users locally to show "Theo dõi lại"
  const [unfollowedUsers, setUnfollowedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  
  // Confirmation dialog state
  const [confirmUser, setConfirmUser] = useState<any>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, error } =
    useInfiniteQuery({
      queryKey: ['following', userId],
      queryFn: ({ pageParam = 1 }) =>
        orvalClient<any>({
          url: `/relations/friends/${userId}?relation=following&mode=following&page=${pageParam}&limit=20`,
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

  const allFollowing =
    data?.pages.flatMap((page: any) => page.data?.data || page.data || []) ||
    [];
  const filteredFollowing = allFollowing.filter(
    (f: any) =>
      !searchTerm ||
      f.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const isForbidden = (error as any)?.response?.status === 403;

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  const unfollowMutation = useMutation({
    mutationFn: ({ targetId, action }: { targetId: string, action: 'none' | 'following' }) =>
      orvalClient({ 
        url: `/relations/update`, 
        method: 'POST', 
        data: { user_id: targetId, relation: action } 
      }),
    onSuccess: (_, variables) => {
      let increment = 0;
      if (variables.action === 'none') {
        setUnfollowedUsers(prev => new Set(prev).add(variables.targetId));
        increment = -1;
      } else {
        setUnfollowedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(variables.targetId);
          return newSet;
        });
        increment = 1;
      }
      setConfirmUser(null);
      
      // Optimistic update for following count in profile
      queryClient.setQueryData(['profile', userId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          followingCount: Math.max(0, (oldData.followingCount || 0) + increment),
        };
      });
    },
  });

  const confirmUnfollow = () => {
    if (confirmUser) {
      unfollowMutation.mutate({ targetId: confirmUser.id, action: 'none' });
    }
  };

  const handleRefollow = (targetId: string) => {
    unfollowMutation.mutate({ targetId, action: 'following' });
  };

  const handleCloseModal = () => {
    onClose();
    setTimeout(() => setUnfollowedUsers(new Set()), 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center border-b pb-4">Đang theo dõi</DialogTitle>
        </DialogHeader>
        <div className="p-2 relative">
          <Search className="w-4 h-4 absolute left-4 top-5 text-muted-foreground" />
          <Input 
            placeholder="Tìm kiếm" 
            className="pl-8 bg-muted/50 border-none" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto mt-2 pb-4">
          {status === 'pending' ? (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : status === 'error' ? (
            <div className={`text-center text-sm py-4 ${isForbidden ? 'text-muted-foreground' : 'text-destructive'}`}>
              {isForbidden
                ? 'Bạn không có quyền xem danh sách này'
                : 'Lỗi tải danh sách'}
            </div>
          ) : filteredFollowing.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {searchTerm ? 'Không tìm thấy người dùng phù hợp' : 'Chưa theo dõi ai'}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {filteredFollowing.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          handleCloseModal();
                          navigate(`/profile/${f.user?.id}`);
                        }}
                      >
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
                        unfollowedUsers.has(f.user?.id) ? (
                          <Button 
                            variant="default" 
                            size="sm"
                            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 w-[110px]"
                            onClick={() => handleRefollow(f.user?.id)}
                            disabled={unfollowMutation.isPending && unfollowMutation.variables?.targetId === f.user?.id}
                          >
                            {unfollowMutation.isPending && unfollowMutation.variables?.targetId === f.user?.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Theo dõi"
                            )}
                          </Button>
                        ) : (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            className="font-semibold w-[110px]"
                            onClick={() => setConfirmUser(f.user)}
                            disabled={unfollowMutation.isPending && unfollowMutation.variables?.targetId === f.user?.id}
                          >
                            {unfollowMutation.isPending && unfollowMutation.variables?.targetId === f.user?.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Đang theo dõi"
                            )}
                          </Button>
                        )
                      )}
                    </div>
                  ))}
                </div>
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
            <Avatar className="w-24 h-24 mb-4">
              <AvatarImage src={confirmUser.avatar || '/default-avatar.png'} className="object-cover" />
              <AvatarFallback>{confirmUser.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          <AlertDialogHeader className="flex flex-col items-center text-center w-full">
            <AlertDialogTitle className="text-xl font-normal">Bỏ theo dõi @{confirmUser?.username}?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col w-full sm:flex-col sm:space-x-0 mt-6 gap-0 border-t">
            <AlertDialogAction 
              onClick={confirmUnfollow}
              className="w-full bg-transparent text-destructive hover:bg-muted text-base font-bold shadow-none rounded-none border-b py-6"
              disabled={unfollowMutation.isPending}
            >
              {unfollowMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Bỏ theo dõi"}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full border-none shadow-none mt-0 text-base py-6 rounded-none">Hủy</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
