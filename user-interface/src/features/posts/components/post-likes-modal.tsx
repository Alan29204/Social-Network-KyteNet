import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useReactionsControllerGetPostReactionUsersInfinite,
  useReactionsControllerGetReactionSummary,
} from '@/services/apis/gen/queries';
import { keepPreviousData } from '@tanstack/react-query';
import { getAvatarUrl, getDisplayName } from '@/utils/user';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { REACTIONS, getReactionMeta } from './reaction-picker';

interface PostLikesModalProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getItems = (page: any) => page?.data?.data || page?.data || [];
const getMeta = (page: any) => page?.data?.meta || page?.meta || {};

export function PostLikesModal({
  postId,
  open,
  onOpenChange,
}: PostLikesModalProps) {
  const navigate = useNavigate();
  const { ref, inView } = useInView();
  const [tab, setTab] = useState<string>('all'); // 'all' | loại cảm xúc

  useEffect(() => {
    if (open) setTab('all');
  }, [open]);

  // Tổng + breakdown để hiển thị số đếm trên mỗi tab.
  const { data: summaryRes } = useReactionsControllerGetReactionSummary(
    postId,
    { query: { enabled: open && !!postId } },
  );
  const summary = (summaryRes as any)?.data || {};
  const total: number = summary.total || 0;
  const breakdown: Record<string, number> = summary.breakdown || {};

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useReactionsControllerGetPostReactionUsersInfinite(
      postId,
      { limit: 20, reaction: (tab === 'all' ? undefined : tab) as any },
      {
        query: {
          enabled: open && !!postId,
          initialPageParam: 1,
          placeholderData: keepPreviousData,
          getNextPageParam: (lastPage: any) => {
            const meta = getMeta(lastPage);
            return meta.page < meta.last_page ? meta.page + 1 : undefined;
          },
        },
      },
    );

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, inView, isFetchingNextPage]);

  const users = data?.pages.flatMap(getItems) || [];

  const goToProfile = (userId: string) => {
    onOpenChange(false);
    navigate(`/profile/${userId}`);
  };

  const availableReactions = REACTIONS.filter((r) => (breakdown[r.type] || 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Cảm xúc</DialogTitle>
        </DialogHeader>

        {/* Tabs: Tất cả + từng loại có người thả */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-2">
          <button
            onClick={() => setTab('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              tab === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            Tất cả {total}
          </button>
          {availableReactions.map((r) => (
            <button
              key={r.type}
              onClick={() => setTab(r.type)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                tab === r.type
                  ? 'bg-secondary'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              <span className="text-base leading-none">{r.emoji}</span>
              {breakdown[r.type]}
            </button>
          ))}
        </div>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pb-2">
          {status === 'pending' ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : status === 'error' ? (
            <div className="py-8 text-center text-sm text-destructive">
              Không thể tải danh sách.
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Chưa có ai bày tỏ cảm xúc.
            </div>
          ) : (
            <>
              {users.map((item: any) => {
                const meta = getReactionMeta(item.reaction);
                return (
                  <button
                    key={`${item.id}-${item.reacted_at}`}
                    className="flex items-center gap-3 text-left transition-opacity hover:opacity-80"
                    onClick={() => goToProfile(item.id)}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage
                          src={getAvatarUrl(item.avatar)}
                          className="object-cover"
                        />
                        <AvatarFallback>
                          {item.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {meta && (
                        <span className="absolute -bottom-1 -right-1 text-sm leading-none">
                          {meta.emoji}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col text-sm">
                      <span className="truncate font-semibold">
                        {getDisplayName(item)}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {item.username ? `@${item.username}` : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
              <div ref={ref} className="flex justify-center py-2">
                {isFetchingNextPage && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
