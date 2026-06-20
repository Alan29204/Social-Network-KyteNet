import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ReactionsControllerGetPostReactionUsersReaction,
  useReactionsControllerGetPostReactionUsersInfinite,
} from '@/services/apis/gen/queries';
import { getAvatarUrl, getDisplayName } from '@/utils/user';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useReactionsControllerGetPostReactionUsersInfinite(
      postId,
      {
        limit: 20,
        reaction: ReactionsControllerGetPostReactionUsersReaction.like,
      },
      {
        query: {
          enabled: open && !!postId,
          initialPageParam: 1,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center border-b pb-4">
            Người thích bài viết
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[420px] flex-col gap-4 overflow-y-auto pb-2">
          {status === 'pending' ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : status === 'error' ? (
            <div className="py-8 text-center text-sm text-destructive">
              Không thể tải danh sách người thích.
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Chưa có ai thích bài viết này.
            </div>
          ) : (
            <>
              {users.map((item: any) => (
                <button
                  key={`${item.id}-${item.reacted_at}`}
                  className="flex items-center gap-3 text-left transition-opacity hover:opacity-80"
                  onClick={() => goToProfile(item.id)}
                >
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage
                      src={getAvatarUrl(item.avatar)}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      {item.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col text-sm">
                    <span className="truncate font-semibold">
                      {getDisplayName(item)}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {item.username ? `@${item.username}` : ''}
                    </span>
                  </div>
                </button>
              ))}
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
