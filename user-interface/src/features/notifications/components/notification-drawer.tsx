import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getNotificationControllerGetUnreadCountQueryKey, getNotificationControllerGetUserNotificationsInfiniteQueryKey, useNotificationControllerGetUserNotificationsInfinite, useNotificationControllerMarkAsRead, useNotificationControllerMarkAllAsRead, useNotificationControllerDeleteNotification, useNotificationControllerMarkAsUnread } from '@/services/apis/gen/queries';
import { orvalClient } from '@/services/apis/axios-client';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePostModalStore } from '@/features/posts/stores/post-modal-store';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { BellRing } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const { ref, inView } = useInView();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const markAllAsReadMutation = useNotificationControllerMarkAllAsRead({
    mutation: {
      onSuccess: () => {
        queryClient.setQueriesData({ queryKey: getNotificationControllerGetUserNotificationsInfiniteQueryKey() }, (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: {
                ...page.data,
                data: (page.data?.data || []).map((n: any) => ({ ...n, is_read: true }))
              }
            }))
          };
        });
        queryClient.setQueriesData({ queryKey: getNotificationControllerGetUnreadCountQueryKey() }, (old: any) => {
           return { ...old, data: { ...old?.data, unread_count: 0 } };
        });
        toast({ title: 'Đã đánh dấu tất cả là đã đọc' });
      },
    }
  });

  const handleDeleteAll = async () => {
    try {
      setIsDeletingAll(true);
      await orvalClient({ url: '/notifications/all', method: 'DELETE' });
      queryClient.setQueriesData({ queryKey: getNotificationControllerGetUserNotificationsInfiniteQueryKey() }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: { ...page.data, data: [] }
          }))
        };
      });
      queryClient.setQueriesData({ queryKey: getNotificationControllerGetUnreadCountQueryKey() }, (old: any) => {
        return { ...old, data: { ...old?.data, unread_count: 0 } };
      });
      setShowDeleteAllConfirm(false);
      toast({ title: 'Đã xóa tất cả thông báo' });
    } catch (error) {
      toast({ title: 'Có lỗi xảy ra khi xóa', variant: 'destructive' });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useNotificationControllerGetUserNotificationsInfinite(
    { limit: 20, is_read: filter === 'unread' ? false : undefined },
    { 
      query: { 
        enabled: isOpen,
        initialPageParam: 1,
        staleTime: 60000, // Optimize API call cache
        getNextPageParam: (lastPage: any) => {
          const meta = lastPage?.data?.meta || lastPage?.meta;
          if (meta && meta.page < meta.totalPages) {
            return meta.page + 1;
          }
          return undefined;
        }
      } 
    }
  );

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // Flatten the pages into a single array of notifications
  const notifications = data?.pages.flatMap((page: any) => {
    const items = page?.data?.data || page?.data || [];
    return items;
  }) || [];

  return (
    <>
      {/* Optional Overlay for mobile or closing when clicking outside (on desktop, Instagram just lets it sit there and closes when clicking elsewhere. We can use a transparent overlay) */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-transparent" 
          onClick={onClose} 
        />
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 left-[72px] h-screen w-[397px] bg-background border-r border-border z-30 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col rounded-r-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 md:p-6 pb-2 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">Thông báo</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => markAllAsReadMutation.mutate()}>
                Đánh dấu tất cả là đã đọc
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDeleteAllConfirm(true)} className="text-red-500">
                Xóa tất cả thông báo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="px-4 md:px-6 flex gap-2 pb-2">
          <Button 
            variant={filter === 'all' ? 'default' : 'secondary'} 
            className="rounded-full h-8 px-4 text-xs font-semibold"
            onClick={() => setFilter('all')}
          >
            Tất cả
          </Button>
          <Button 
            variant={filter === 'unread' ? 'default' : 'secondary'} 
            className="rounded-full h-8 px-4 text-xs font-semibold"
            onClick={() => setFilter('unread')}
          >
            Chưa đọc
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 mt-10">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
                <BellRing className="w-10 h-10 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Không có thông báo</h3>
              <p className="text-sm text-center">Khi bạn có thông báo mới, chúng sẽ xuất hiện ở đây.</p>
            </div>
          ) : (
            notifications.map((noti: any) => (
              <NotificationItem key={noti.id} notification={noti} onClose={onClose} />
            ))
          )}

          {/* Infinite scroll trigger */}
          {hasNextPage && (
            <div ref={ref} className="flex justify-center p-4">
              {isFetchingNextPage && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <AlertDialogContent className="max-w-[400px] gap-0 p-0 overflow-hidden bg-card border-none rounded-xl">
          <AlertDialogHeader className="text-center p-6 pb-4">
            <AlertDialogTitle className="text-center font-semibold text-lg">
              Xóa tất cả thông báo?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col items-stretch space-x-0 border-t border-border mt-0 gap-0">
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAll();
              }}
              className="w-full bg-transparent text-destructive hover:bg-muted text-base font-bold shadow-none rounded-none py-4 h-auto border-b border-border"
              disabled={isDeletingAll}
            >
              {isDeletingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : "Xóa tất cả"}
            </AlertDialogAction>
            <AlertDialogCancel 
              className="w-full bg-transparent hover:bg-muted text-base shadow-none rounded-none border-0 py-4 h-auto m-0"
              disabled={isDeletingAll}
              onClick={() => setShowDeleteAllConfirm(false)}
            >
              Hủy
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatNotificationMessage(message: string, actors: any[]) {
  if (!message) return null;
  
  let tempMessage = message.replace('cảm xúc like về', 'cảm xúc về');
  const placeholders: { [key: string]: string } = {};
  
  actors.forEach((actor, i) => {
    if (!actor.username) return;
    const placeholder = `__ACTOR_${i}__`;
    tempMessage = tempMessage.replace(actor.username, placeholder);
    placeholders[placeholder] = actor.username;
  });

  const parts = tempMessage.split(/(__ACTOR_\d+__)/);

  return parts.map((part, index) => {
    if (placeholders[part]) {
      return <span key={index} className="font-semibold">{placeholders[part]}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}

function NotificationItem({ notification, onClose }: { notification: any, onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isReadLocal, setIsReadLocal] = useState(notification.is_read);
  const [isHandling, setIsHandling] = useState(false);
  
  const markAsReadMutation = useNotificationControllerMarkAsRead({});
  const markAsUnreadMutation = useNotificationControllerMarkAsUnread({});
  const deleteMutation = useNotificationControllerDeleteNotification({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Đã xóa thông báo' });
      }
    }
  });

  const updateListCache = (isRead: boolean) => {
    queryClient.setQueriesData({ queryKey: getNotificationControllerGetUserNotificationsInfiniteQueryKey() }, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          data: {
            ...page.data,
            data: (page.data?.data || []).map((n: any) => n.id === notification.id ? { ...n, is_read: isRead } : n)
          }
        }))
      };
    });
  };

  // notification.metadata contains actors and thumbnail
  const metadata = notification.metadata || {};
  const actors = metadata.actors || [];
  const primaryActor = actors[0];

  let dateString = notification.updated_at || notification.created_at;
  if (dateString && !dateString.endsWith('Z')) {
    dateString += 'Z';
  }
  const dateObj = new Date(dateString);

  const timeAgo = formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: vi,
  });

  const handleClick = async () => {
    console.log('[NOTI-DEBUG] FULL notification object:', JSON.stringify(notification, null, 2));
    console.log('[NOTI-DEBUG] ALL KEYS:', Object.keys(notification));
    console.log('[NOTI-DEBUG] handleClick called', { isHandling, target_type: notification.target_type, target_id: notification.target_id });
    if (isHandling) return;
    setIsHandling(true);

    if (!isReadLocal) {
      setIsReadLocal(true);
      markAsReadMutation.mutate({ id: notification.id });
      updateListCache(true);
      
      queryClient.setQueriesData({ queryKey: getNotificationControllerGetUnreadCountQueryKey() }, (old: any) => {
        if (old?.data?.unread_count > 0) {
          return { ...old, data: { ...old.data, unread_count: old.data.unread_count - 1 } };
        }
        return old;
      });
    }

    const { target_type, target_id, metadata } = notification;
    console.log('[NOTI-DEBUG] target_type:', target_type, 'target_id:', target_id, 'metadata:', metadata);

    if (target_type === 'POST') {
      try {
        console.log('[NOTI-DEBUG] Fetching post...');
        await queryClient.fetchQuery({
           queryKey: ['postDetail', target_id],
           queryFn: () => orvalClient({ url: `/posts/${target_id}`, method: 'GET' })
        });
        console.log('[NOTI-DEBUG] Post fetched. Opening modal...');
        
        // IMPORTANT: Set store state BEFORE closing drawer to avoid React batching issues
        if (metadata?.commentId) {
          usePostModalStore.getState().openPost(target_id, metadata.commentId);
        } else {
          usePostModalStore.getState().openPost(target_id);
        }
        console.log('[NOTI-DEBUG] Store state after openPost:', usePostModalStore.getState());

        // Close drawer AFTER store is updated
        onClose();
      } catch (error: any) {
        if (error.response?.status === 404) {
           toast({ title: "Bài viết này không còn khả dụng hoặc đã bị xóa" });
        } else {
           toast({ title: "Không thể tải nội dung, vui lòng kiểm tra kết nối mạng" });
           setIsReadLocal(false);
           queryClient.setQueriesData({ queryKey: getNotificationControllerGetUnreadCountQueryKey() }, (old: any) => {
             if (old?.data?.unread_count !== undefined) {
               return { ...old, data: { ...old.data, unread_count: old.data.unread_count + 1 } };
             }
             return old;
           });
        }
      } finally {
        setIsHandling(false);
      }
    } else if (target_type === 'USER') {
      onClose();
      navigate(`/profile/${primaryActor?.id || target_id}`);
      setIsHandling(false);
    } else {
      onClose();
      setIsHandling(false);
    }
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadLocal) {
      // Mark as unread
      setIsReadLocal(false);
      markAsUnreadMutation.mutate({ id: notification.id });
      updateListCache(false);
      queryClient.setQueriesData({ queryKey: getNotificationControllerGetUnreadCountQueryKey() }, (old: any) => {
        if (old?.data?.unread_count !== undefined) {
          return { ...old, data: { ...old.data, unread_count: old.data.unread_count + 1 } };
        }
        return old;
      });
    } else {
      // Mark as read
      setIsReadLocal(true);
      markAsReadMutation.mutate({ id: notification.id });
      updateListCache(true);
      queryClient.setQueriesData({ queryKey: getNotificationControllerGetUnreadCountQueryKey() }, (old: any) => {
        if (old?.data?.unread_count > 0) {
          return { ...old, data: { ...old.data, unread_count: old.data.unread_count - 1 } };
        }
        return old;
      });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate({ id: notification.id });
    if (!isReadLocal) {
      queryClient.setQueriesData({ queryKey: getNotificationControllerGetUnreadCountQueryKey() }, (old: any) => {
        if (old?.data?.unread_count > 0) {
          return { ...old, data: { ...old.data, unread_count: old.data.unread_count - 1 } };
        }
        return old;
      });
    }
    // Optimistically remove from list
    queryClient.setQueriesData({ queryKey: getNotificationControllerGetUserNotificationsInfiniteQueryKey() }, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          data: {
            ...page.data,
            data: (page.data?.data || []).filter((n: any) => n.id !== notification.id)
          }
        }))
      };
    });
  };

  return (
    <div 
      onClick={handleClick}
      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer group ${
        !isReadLocal ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''
      }`}
    >
      {/* Left: Avatar */}
      <Avatar className="w-11 h-11 border bg-muted shrink-0">
        <AvatarImage src={primaryActor?.avatar ? (primaryActor.avatar.startsWith('http') ? primaryActor.avatar : `${import.meta.env.VITE_MEDIA_URL}/${primaryActor.avatar}`) : '/default-avatar.png'} alt={primaryActor?.username || 'User'} className="object-cover" />
        <AvatarFallback>{primaryActor?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
      </Avatar>

      {/* Middle: Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center text-[14px]">
        <span className="text-foreground leading-tight">
          {formatNotificationMessage(notification.message, actors)}
        </span>
        <span className="text-muted-foreground text-[12px] mt-0.5 leading-none">{timeAgo}</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 shrink-0 ml-1">
        {notification.notification_type === 'FOLLOW' && (
          <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold px-3 mr-1" onClick={(e) => e.stopPropagation()}>
            Theo dõi lại
          </Button>
        )}
        
        {/* Unread indicator dot */}
        {!isReadLocal && (
          <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleToggleRead}>
              {isReadLocal ? 'Đánh dấu là chưa đọc' : 'Đánh dấu là đã đọc'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-red-500">
              Xóa thông báo này
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
