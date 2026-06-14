import { Loader2 } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useBlockUser } from '../hooks/use-block-user';

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; username: string; avatar?: string };
  /** 'block' để chặn, 'unblock' để bỏ chặn. Mặc định 'block'. */
  mode?: 'block' | 'unblock';
  onSuccess?: () => void;
}

/**
 * Dialog xác nhận chặn / bỏ chặn người dùng (destructive).
 * Dùng chung cho ProfileHeader và trang Tài khoản đã chặn.
 */
export function BlockUserDialog({
  open,
  onOpenChange,
  user,
  mode = 'block',
  onSuccess,
}: BlockUserDialogProps) {
  const { blockMutation, unblockMutation } = useBlockUser();
  const isBlock = mode === 'block';
  const mutation = isBlock ? blockMutation : unblockMutation;

  const handleConfirm = () => {
    mutation.mutate(user.id, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[420px]">
        <AlertDialogHeader className="items-center text-center">
          <Avatar className="w-20 h-20 border mb-2">
            <AvatarImage
              src={user.avatar || '/default-avatar.png'}
              className="object-cover"
            />
            <AvatarFallback>
              {user.username?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <AlertDialogTitle className="text-lg">
            {isBlock ? `Chặn @${user.username}?` : `Bỏ chặn @${user.username}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {isBlock ? (
              <>
                Họ sẽ không thể tìm thấy trang cá nhân, bài viết hoặc nhắn tin
                cho bạn. Người này sẽ <b>không nhận được thông báo</b> rằng bạn
                đã chặn họ.
              </>
            ) : (
              <>
                Bạn có thể theo dõi và nhắn tin lại với người này. Các lượt
                thích và bình luận trước đó sẽ không được khôi phục tự động.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-col-reverse gap-2">
          <AlertDialogCancel className="m-0" disabled={mutation.isPending}>
            Hủy
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={mutation.isPending}
            className={
              isBlock
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isBlock ? (
              'Chặn'
            ) : (
              'Bỏ chặn'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
