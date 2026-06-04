import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getNotificationControllerGetUnreadCountQueryKey, getNotificationControllerGetUserNotificationsInfiniteQueryKey, useNotificationControllerGetUserNotificationsInfinite, useNotificationControllerMarkAsRead } from '@/services/apis/gen/queries';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const { ref, inView } = useInView();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useNotificationControllerGetUserNotificationsInfinite(
    { limit: 20 },
    { 
      query: { 
        enabled: isOpen,
        initialPageParam: 1,
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
        <div className="p-4 md:p-6 pb-2">
          <h2 className="text-2xl font-bold text-foreground">Thông báo</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground">
              Không có thông báo nào.
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
  
  const markAsReadMutation = useNotificationControllerMarkAsRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getNotificationControllerGetUnreadCountQueryKey() });
        queryClient.invalidateQueries({ queryKey: getNotificationControllerGetUserNotificationsInfiniteQueryKey() });
      }
    }
  });

  // notification.metadata contains actors and thumbnail
  const metadata = notification.metadata || {};
  const actors = metadata.actors || [];
  const primaryActor = actors[0];

  let dateString = notification.updated_at || notification.created_at;
  let dateObj = new Date(dateString);

  // Fix timezone shift from Postgres TIMESTAMP WITHOUT TIMEZONE
  // The backend sends a UTC string that is actually shifted backwards by the local timezone offset
  const offset = dateObj.getTimezoneOffset();
  dateObj = new Date(dateObj.getTime() - (offset * 60 * 1000));

  const timeAgo = formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: vi,
  });

  const handleClick = () => {
    if (!notification.is_read) {
      markAsReadMutation.mutate({ id: notification.id });
    }
    
    onClose();

    if (notification.target_type === 'POST') {
      navigate(`/post/${notification.target_id}`);
    } else if (notification.target_type === 'USER') {
      navigate(`/profile/${notification.target_id}`);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer group"
    >
      {/* Left: Avatar */}
      <Avatar className="w-11 h-11 border bg-muted shrink-0">
        <AvatarImage src={primaryActor?.avatar || ''} alt={primaryActor?.username || 'User'} className="object-cover" />
        <AvatarFallback>{primaryActor?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
      </Avatar>

      {/* Middle: Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center text-[14px]">
        <span className="text-foreground leading-tight">
          {formatNotificationMessage(notification.message, actors)}
          <span className="text-muted-foreground text-[13px] ml-1">{timeAgo}</span>
        </span>
      </div>

      {/* Right: Action button */}
      {notification.notification_type === 'FOLLOW' && (
        <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold px-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          Theo dõi lại
        </Button>
      )}
      
      {/* Unread indicator dot */}
      {!notification.is_read && (
        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-1" />
      )}
    </div>
  );
}
