import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook chặn/bỏ chặn người dùng (Mục III/VII).
 * - Block: gọi POST /relations/block, invalidate feed/search/profile/chat.
 * - Unblock: gọi POST /relations/unblock.
 */
export function useBlockUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['search'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
  };

  const blockMutation = useMutation({
    mutationFn: (userId: string) =>
      orvalClient({
        url: '/relations/block',
        method: 'POST',
        data: { user_id: userId },
      }),
    onSuccess: () => {
      toast({
        title: 'Đã chặn thành công',
        description:
          'Người này không thể xem trang cá nhân, nhắn tin hay tương tác với bạn.',
      });
      invalidateAll();
    },
    onError: () => {
      toast({
        title: 'Không thể chặn người dùng',
        description: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
        variant: 'destructive',
      });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) =>
      orvalClient({
        url: '/relations/unblock',
        method: 'POST',
        data: { user_id: userId },
      }),
    onSuccess: () => {
      toast({
        title: 'Đã bỏ chặn',
        description:
          'Bạn có thể theo dõi lại người này. Lưu ý: các tương tác cũ không được khôi phục.',
      });
      invalidateAll();
    },
    onError: () => {
      toast({
        title: 'Không thể bỏ chặn',
        description: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
        variant: 'destructive',
      });
    },
  });

  return { blockMutation, unblockMutation };
}
