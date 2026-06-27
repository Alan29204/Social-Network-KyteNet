import { useState } from 'react';
import { Wind, Video, Image as ImageIcon, Smile } from 'lucide-react';
import { CreatePostModal } from '@/features/posts/components/create-post-modal';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { getDisplayName } from '@/utils/user';

/**
 * Thanh "tạo bài viết" ở đầu trang chủ. Bấm vào mở đúng CreatePostModal như
 * nút "Tạo" ở sidebar. Không có avatar — chỉ icon gió bên trái, lời mời ở giữa,
 * và các icon đính kèm/emoji bên phải (mang tính gợi ý).
 */
export function FeedComposer() {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();
  const name = getDisplayName(user);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 w-full rounded-full bg-muted/50 hover:bg-muted transition-colors px-3 py-2.5 mb-3"
      >
        {/* Icon gió (thay cho avatar) */}
        <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-kyte-blue to-kyte-coral text-white">
          <Wind className="w-5 h-5" />
        </span>

        {/* Lời mời */}
        <span className="flex-1 text-left text-sm text-muted-foreground truncate">
          {name} ơi, bạn đang nghĩ gì thế?
        </span>

        {/* Icon gợi ý đính kèm / emoji */}
        <span className="flex items-center gap-2 shrink-0">
          <Video className="w-5 h-5 text-red-500" />
          <ImageIcon className="w-5 h-5 text-green-500" />
          <Smile className="w-5 h-5 text-amber-500" />
        </span>
      </button>

      <CreatePostModal open={open} onOpenChange={setOpen} />
    </>
  );
}
