import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  chatRoomsControllerMarkRoomAsRead,
  getChatMessagesControllerGetMessageHistoryQueryKey,
  useChatMessagesControllerCreateMessage,
  useChatMessagesControllerGetMessageHistory,
  useChatRoomsControllerFindChatRoomById,
  useChatRoomsControllerGetOrCreateDirectChat,
} from '@/services/apis/gen/queries';
import {
  FloatingChatRecipient,
  useFloatingChatStore,
} from '@/features/chats/stores/floating-chat-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Maximize,
  Send,
  Smile,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useNavigate } from 'react-router-dom';
import { socketService } from '@/services/socket.service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { useToast } from '@/hooks/use-toast';
import {
  isChatRoomsQueryKey,
  upsertChatRoomInCaches,
} from '@/features/chats/utils/chat-room-cache';
import { MessagePostCard } from './message-post-card';
import { getDisplayName, getGroupAvatarUrl, getUserAvatarUrl } from '@/utils/user';

type FloatingRoomMember = {
  id: string;
  username?: string;
  full_name?: string;
  avatar?: string;
  profile_picture_url?: string;
  status?: string;
  unread_count?: number;
};

type FloatingRoom = {
  id: string;
  name?: string;
  type?: string;
  avatar?: string;
  quick_emoji?: string;
  is_blocked?: boolean;
  members?: FloatingRoomMember[];
};

type FloatingMessage = {
  id: string;
  chat_room_id: string;
  created_by: string;
  message?: string;
  content?: string;
  medias?: string[];
  local_media_types?: string[];
  shared_post_id?: string;
  shared_post?: any;
  user?: any;
  created_at?: string;
  message_status?: string;
  is_sending?: boolean;
  is_failed?: boolean;
};

type FloatingChatRoomProps = {
  roomId: string | null;
  virtualRecipient?: FloatingChatRecipient | null;
};

const EMOJIS = ['❤️', '😂', '👍', '🔥', '😍', '😢', '🙌', '👏'];

const isVideo = (url: string, type?: string) =>
  type?.startsWith('video') ||
  /\.(mp4|webm|ogg|mov|m4v)$/i.test(url.split('?')[0] || '');

const mediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:')) return url;
  const base = import.meta.env.VITE_MEDIA_URL || 'http://localhost:3000';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const isSystemOrDeleted = (msg: FloatingMessage) => {
  const status = (msg.message_status || '').toLowerCase();
  return status === 'system' || status === 'deleted';
};

const isGroupableMessage = (msg: FloatingMessage) =>
  !isSystemOrDeleted(msg) &&
  !msg.shared_post_id &&
  !(msg.medias && msg.medias.length > 0);

const isWithinFiveMinutes = (a?: FloatingMessage | null, b?: FloatingMessage) => {
  if (!a?.created_at || !b?.created_at) return false;
  return (
    Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) <=
    5 * 60 * 1000
  );
};

export function FloatingChatRoom({
  roomId,
  virtualRecipient,
}: FloatingChatRoomProps) {
  const { user, accessToken } = useAuthStore();
  const {
    goBackToList,
    closeChat,
    hasUnreadInOtherRoom,
    setHasUnreadInOtherRoom,
    setActiveRoom,
  } = useFloatingChatStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messageText, setMessageText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { data: roomData, isLoading: isLoadingRoom } =
    useChatRoomsControllerFindChatRoomById(roomId || '', {
      query: { enabled: !!roomId },
    });
  const roomPayload = roomData as unknown as { data?: FloatingRoom };
  const room = roomPayload?.data;

  const { data: messagesData, isLoading: isLoadingMessages } =
    useChatMessagesControllerGetMessageHistory(
      roomId || '',
      { limit: 50 },
      { query: { enabled: !!roomId } },
    );

  const createDirectChatMutation = useChatRoomsControllerGetOrCreateDirectChat();
  const createMessageMutation = useChatMessagesControllerCreateMessage();

  const virtualRoom = useMemo<FloatingRoom | null>(() => {
    if (!virtualRecipient || !user) return null;
    return {
      id: 'virtual',
      type: 'direct',
      name: getDisplayName(virtualRecipient),
      quick_emoji: '👍',
      members: [
        {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          avatar: user.avatar,
          status: 'accepted',
        },
        {
          id: virtualRecipient.id,
          username: virtualRecipient.username,
          full_name: virtualRecipient.full_name,
          avatar: virtualRecipient.avatar,
          profile_picture_url:
            virtualRecipient.profile_picture_url || virtualRecipient.avatar,
          status: 'pending',
        },
      ],
    };
  }, [user, virtualRecipient]);

  const activeRoom = room || virtualRoom;
  const messagesPayload = messagesData as unknown as {
    data?: { data?: FloatingMessage[] };
  };
  const messages = messagesPayload?.data?.data || [];
  const displayMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime(),
      ),
    [messages],
  );

  const currentMember = activeRoom?.members?.find((m) => m.id === user?.id);
  const otherUser = activeRoom?.members?.find((m) => m.id !== user?.id);
  const isGroup = activeRoom?.type === 'group';
  const roomName = isGroup
    ? activeRoom?.name || 'Group Chat'
    : getDisplayName(otherUser);
  const roomAvatar = isGroup
    ? getGroupAvatarUrl(activeRoom?.avatar)
    : getUserAvatarUrl(otherUser);

  const getMessageActor = (msg: FloatingMessage) =>
    msg.user ||
    activeRoom?.members?.find(
      (member) => member.id === msg.created_by || (member as any).user_id === msg.created_by,
    );

  const getSystemMessageText = (msg: FloatingMessage) => {
    const messageText = msg.message || '';
    if (messageText.trim().toLowerCase() === 'đã tạo nhóm') {
      return `${getDisplayName(getMessageActor(msg))} đã tạo nhóm`;
    }
    return messageText;
  };
  // Kiểm tra chặn 2 chiều cho cả chat thật lẫn chat ảo (virtualRecipient).
  const otherUserId = !isGroup
    ? otherUser?.id || virtualRecipient?.id
    : undefined;
  const { data: blockStatus } = useQuery({
    queryKey: ['block-status', otherUserId],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get(
        `/relations/block-status/${otherUserId}`,
      );
      const body = res?.data?.data ?? res?.data;
      return !!body?.is_blocked;
    },
    enabled: !!otherUserId,
  });

  const isBlocked = !!activeRoom?.is_blocked || !!blockStatus;
  const canSend =
    !isBlocked &&
    (currentMember?.status || '').toLowerCase() !== 'pending';

  const latestMineMessage = useMemo(
    () =>
      [...displayMessages]
        .reverse()
        .find((msg) => msg.created_by === user?.id && !isSystemOrDeleted(msg)),
    [displayMessages, user?.id],
  );

  const updateMessageCaches = (
    targetRoomId: string,
    updater: (messages: FloatingMessage[]) => FloatingMessage[],
  ) => {
    const queries = queryClient.getQueryCache().findAll({
      predicate: (query) =>
        query.queryKey[0] === `/chat-messages/${targetRoomId}` ||
        (query.queryKey[0] === 'infinite' &&
          query.queryKey[1] === `/chat-messages/${targetRoomId}`),
    });

    if (queries.length === 0) {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(targetRoomId, {
          limit: 50,
        }),
        {
          data: {
            data: updater([]),
            meta: { has_more: false, next_cursor: null },
          },
        },
      );
      return;
    }

    queries.forEach((query) => {
      queryClient.setQueryData(query.queryKey, (old: any) => {
        if (!old) return old;

        if (Array.isArray(old?.data?.data)) {
          return {
            ...old,
            data: {
              ...old.data,
              data: updater(old.data.data),
            },
          };
        }

        if (Array.isArray(old?.pages)) {
          return {
            ...old,
            pages: old.pages.map((page: any, index: number) =>
              index === old.pages.length - 1 && Array.isArray(page?.data?.data)
                ? {
                    ...page,
                    data: {
                      ...page.data,
                      data: updater(page.data.data),
                    },
                  }
                : page,
            ),
          };
        }

        return old;
      });
    });
  };

  const appendMessage = (message: FloatingMessage) => {
    updateMessageCaches(message.chat_room_id, (list) =>
      list.some((item) => item.id === message.id) ? list : [...list, message],
    );
  };

  const replaceTempMessage = (
    targetRoomId: string,
    tempId: string,
    savedMessage: FloatingMessage,
  ) => {
    updateMessageCaches(targetRoomId, (list) => {
      const withoutDuplicate = list.filter(
        (item) => item.id !== savedMessage.id,
      );
      if (withoutDuplicate.some((item) => item.id === tempId)) {
        return withoutDuplicate.map((item) =>
          item.id === tempId ? savedMessage : item,
        );
      }
      return [...withoutDuplicate, savedMessage];
    });
  };

  const markTempFailed = (targetRoomId: string, tempId: string) => {
    updateMessageCaches(targetRoomId, (list) =>
      list.map((item) =>
        item.id === tempId
          ? { ...item, is_failed: true, is_sending: false }
          : item,
      ),
    );
  };

  useEffect(() => {
    if (accessToken) socketService.connect(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages.length, roomId]);

  // Chỉ đánh dấu đã đọc khi tab đang hiển thị + cửa sổ focus (tránh "Đã xem" sai).
  useEffect(() => {
    if (
      roomId &&
      document.visibilityState === 'visible' &&
      document.hasFocus()
    ) {
      chatRoomsControllerMarkRoomAsRead(roomId).catch(() => {});
    }
  }, [roomId, displayMessages.length]);

  // Khi tab quay lại hiển thị / được focus, đánh dấu đã đọc phòng đang mở.
  useEffect(() => {
    const onActive = () => {
      if (
        roomId &&
        document.visibilityState === 'visible' &&
        document.hasFocus()
      ) {
        chatRoomsControllerMarkRoomAsRead(roomId).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onActive);
    window.addEventListener('focus', onActive);
    return () => {
      document.removeEventListener('visibilitychange', onActive);
      window.removeEventListener('focus', onActive);
    };
  }, [roomId]);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewMessage = (newMsg: FloatingMessage) => {
      if (newMsg.chat_room_id === roomId) {
        appendMessage(newMsg);
        if (
          newMsg.created_by !== user?.id &&
          document.visibilityState === 'visible' &&
          document.hasFocus()
        ) {
          chatRoomsControllerMarkRoomAsRead(newMsg.chat_room_id).catch(() => {});
        }
      } else {
        setHasUnreadInOtherRoom(true);
      }
    };

    const handleMessageSaved = (payload: {
      tempId?: string;
      message?: FloatingMessage;
    }) => {
      if (!payload.message) return;
      if (payload.tempId) {
        replaceTempMessage(
          payload.message.chat_room_id,
          payload.tempId,
          payload.message,
        );
      } else {
        appendMessage(payload.message);
      }
    };

    const handleMessageError = (payload: { tempId?: string }) => {
      if (payload.tempId && roomId) markTempFailed(roomId, payload.tempId);
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageSaved', handleMessageSaved);
    socket.on('messageError', handleMessageError);
    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageSaved', handleMessageSaved);
      socket.off('messageError', handleMessageError);
    };
  }, [roomId, queryClient, user?.id, setHasUnreadInOtherRoom]);

  const invalidateRoomLists = () => {
    queryClient.invalidateQueries({
      predicate: (query) => isChatRoomsQueryKey(query.queryKey),
    });
  };

  const ensureRealRoom = async () => {
    if (roomId) return roomId;
    if (!virtualRecipient) return null;

    const res: any = await createDirectChatMutation.mutateAsync({
      targetUserId: virtualRecipient.id,
    });
    const newRoomId = res?.data?.room_id || res?.room_id;
    const roomView = res?.data?.room || res?.room;

    if (!newRoomId) throw new Error('Không thể tạo phòng chat');

    if (roomView?.id) {
      upsertChatRoomInCaches(queryClient, roomView, user?.id);
    }
    setActiveRoom(newRoomId);
    return newRoomId;
  };

  const sendViaRest = async (
    targetRoomId: string,
    tempId: string,
    payload: Record<string, unknown>,
  ) => {
    const res: any = await createMessageMutation.mutateAsync({
      data: {
        chat_room_id: targetRoomId,
        ...payload,
      } as any,
    });
    const savedMessage = res?.data || res;
    replaceTempMessage(targetRoomId, tempId, savedMessage);
    invalidateRoomLists();
    return savedMessage;
  };

  const handleExpand = () => {
    closeChat();
    navigate(roomId ? `/messages/${roomId}` : '/messages');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const valid = picked.filter(
      (f) =>
        (f.type.startsWith('image/') || f.type.startsWith('video/')) &&
        f.size <= 1024 * 1024 * 100,
    );
    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
    }
    if (valid.length < picked.length) {
      toast({
        description: 'Chỉ gửi được ảnh/video, mỗi tệp ≤100MB.',
        variant: 'destructive',
      });
    }
    e.target.value = '';
  };

  const handleSendMessage = async (customMessage?: string) => {
    const text = customMessage ?? messageText.trim();
    const files = customMessage ? [] : selectedFiles;
    if ((!text && files.length === 0) || !canSend || isSending) return;

    setIsSending(true);
    const previousText = messageText;
    const previousFiles = selectedFiles;
    setMessageText('');
    setSelectedFiles([]);
    setShowEmojiPicker(false);

    try {
      const targetRoomId = await ensureRealRoom();
      if (!targetRoomId) return;

      const tempId = `floating-${Date.now()}`;
      const tempMessage: FloatingMessage = {
        id: tempId,
        chat_room_id: targetRoomId,
        created_by: user?.id || '',
        message: text,
        medias: files.map((file) => URL.createObjectURL(file)),
        local_media_types: files.map((file) => file.type),
        created_at: new Date().toISOString(),
        user,
        is_sending: true,
        message_status: 'normal',
      };
      appendMessage(tempMessage);

      if (files.length > 0) {
        await sendViaRest(targetRoomId, tempId, {
          message: text,
          'medias-messages': files as any,
        });
        return;
      }

      const socket = socketService.getSocket();
      if (socket?.connected) {
        socket.emit('sendMessage', {
          chat_room_id: targetRoomId,
          message: text,
          tempId,
        });
      } else {
        await sendViaRest(targetRoomId, tempId, { message: text });
      }
    } catch (error: any) {
      setMessageText(previousText);
      setSelectedFiles(previousFiles);
      toast({
        title: 'Không thể gửi tin nhắn',
        description:
          error?.response?.data?.message ||
          error?.message ||
          'Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (roomId && isLoadingRoom) {
    return (
      <div className="flex h-[500px] w-[340px] items-center justify-center overflow-hidden rounded-t-xl border border-border bg-card shadow-2xl pointer-events-auto">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[500px] w-[340px] flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-2xl pointer-events-auto z-50">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/95 p-2 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={goBackToList}
            className="relative rounded-full p-2 transition-colors hover:bg-secondary"
            title="Quay lại"
          >
            <ArrowLeft className="h-4 w-4 text-kyte-blue" />
            {hasUnreadInOtherRoom && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-card bg-destructive" />
            )}
          </button>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={roomAvatar} className="object-cover" />
            <AvatarFallback className="bg-muted text-xs" />
          </Avatar>
          <span className="max-w-[140px] truncate text-sm font-bold">
            {roomName}
          </span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            onClick={handleExpand}
            className="rounded-full p-2 transition-colors hover:bg-secondary"
            title="Mở toàn màn hình"
          >
            <Maximize className="h-4 w-4" />
          </button>
          <button
            onClick={closeChat}
            className="rounded-full p-2 transition-colors hover:bg-secondary"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="custom-scrollbar flex-1 overflow-y-auto bg-secondary/10 p-3"
      >
        {isLoadingMessages ? (
          <div className="my-4 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Bắt đầu cuộc trò chuyện
          </div>
        ) : (
          displayMessages.map((msg, idx) => {
            const isMine = msg.created_by === user?.id;
            const sender =
              msg.user ||
              activeRoom?.members?.find((member) => member.id === msg.created_by) ||
              otherUser;
            const prevMsg = idx > 0 ? displayMessages[idx - 1] : null;
            const nextMsg =
              idx < displayMessages.length - 1 ? displayMessages[idx + 1] : null;
            const sameAsPrev =
              prevMsg &&
              prevMsg.created_by === msg.created_by &&
              isGroupableMessage(prevMsg) &&
              isGroupableMessage(msg) &&
              isWithinFiveMinutes(prevMsg, msg);
            const sameAsNext =
              nextMsg &&
              nextMsg.created_by === msg.created_by &&
              isGroupableMessage(nextMsg) &&
              isGroupableMessage(msg) &&
              isWithinFiveMinutes(nextMsg, msg);
            const showAvatar = !isMine && !sameAsNext;
            const status = (msg.message_status || '').toLowerCase();
            const isDeleted = status === 'deleted';
            const isSystem = status === 'system';
            const showOwnStatus = isMine && latestMineMessage?.id === msg.id;

            const R = '18px';
            const r = '4px';
            let bubbleRadius = `${R} ${R} ${R} ${R}`;
            if (isMine) {
              if (sameAsPrev && sameAsNext) bubbleRadius = `${R} ${r} ${r} ${R}`;
              else if (sameAsPrev) bubbleRadius = `${R} ${r} ${R} ${R}`;
              else if (sameAsNext) bubbleRadius = `${R} ${R} ${r} ${R}`;
            } else {
              if (sameAsPrev && sameAsNext) bubbleRadius = `${r} ${R} ${R} ${r}`;
              else if (sameAsPrev) bubbleRadius = `${r} ${R} ${R} ${R}`;
              else if (sameAsNext) bubbleRadius = `${R} ${R} ${R} ${r}`;
            }

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center py-2">
                  <span className="rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                    {getSystemMessageText(msg)}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                style={{ marginTop: sameAsPrev ? 2 : 12 }}
              >
                {!isMine &&
                  (showAvatar ? (
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={getUserAvatarUrl(sender)} className="object-cover" />
                      <AvatarFallback className="bg-muted text-xs" />
                    </Avatar>
                  ) : (
                    <div className="h-7 w-7 shrink-0" />
                  ))}

                <div
                  className={`flex max-w-[74%] flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  {isDeleted ? (
                    <div className="rounded-2xl border border-border/80 px-3 py-1.5 text-sm italic text-muted-foreground">
                      Tin nhắn đã thu hồi
                    </div>
                  ) : (
                    <>
                      {msg.shared_post_id && (
                        <div className={msg.is_sending ? 'opacity-70' : ''}>
                          <MessagePostCard post={msg.shared_post} />
                        </div>
                      )}

                      {msg.medias && msg.medias.length > 0 && (
                        <div
                          className={`grid gap-1 overflow-hidden ${
                            msg.medias.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                          } ${msg.is_sending ? 'opacity-70' : ''}`}
                          style={{ borderRadius: bubbleRadius }}
                        >
                          {msg.medias.map((url, mediaIdx) => {
                            const fullUrl = mediaUrl(url);
                            const video = isVideo(
                              url,
                              msg.local_media_types?.[mediaIdx],
                            );
                            return video ? (
                              <video
                                key={`${msg.id}-${mediaIdx}`}
                                src={fullUrl}
                                controls
                                className="max-h-44 w-full object-cover"
                              />
                            ) : (
                              <img
                                key={`${msg.id}-${mediaIdx}`}
                                src={fullUrl}
                                alt="attachment"
                                className="max-h-44 w-full object-cover"
                              />
                            );
                          })}
                        </div>
                      )}

                      {(msg.message || msg.content) && (
                        <div
                          className={`w-fit px-3 py-2 text-[14px] leading-relaxed ${
                            isMine
                              ? 'bg-kyte-blue text-white'
                              : 'border border-border bg-secondary text-foreground'
                          } ${msg.is_sending ? 'opacity-70' : ''} ${
                            msg.is_failed ? 'bg-destructive text-white' : ''
                          }`}
                          style={{ borderRadius: bubbleRadius, wordBreak: 'break-word' }}
                        >
                          {msg.message || msg.content}
                        </div>
                      )}
                    </>
                  )}

                  {showOwnStatus && (
                    <div
                      className={`mt-1 min-h-4 text-[11px] ${
                        msg.is_failed
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {msg.is_failed
                        ? 'Không gửi được'
                        : msg.is_sending
                          ? 'Đang gửi...'
                          : activeRoom?.type === 'direct' &&
                              otherUser?.unread_count === 0
                            ? 'Đã xem'
                            : 'Đã gửi'}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-card p-2">
        {isBlocked ? (
          <div className="py-2 text-center text-sm text-muted-foreground">
            Bạn không thể nhắn tin với người dùng này.
          </div>
        ) : currentMember?.status?.toLowerCase() === 'pending' ? (
          <div className="py-2 text-center text-sm text-muted-foreground">
            Bạn cần chấp nhận tin nhắn đang chờ trong trang Messages.
          </div>
        ) : (
          <>
            {selectedFiles.length > 0 && (
              <div className="mb-2 flex max-h-16 gap-2 overflow-x-auto">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex max-w-[130px] items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedFiles((prev) =>
                          prev.filter((_, fileIdx) => fileIdx !== idx),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="relative flex flex-1 items-center rounded-full border border-transparent bg-secondary px-3 py-1.5 transition-all focus-within:border-kyte-blue/30 focus-within:bg-background">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className="mr-2 shrink-0 text-muted-foreground hover:text-kyte-blue"
                >
                  <Smile className="h-5 w-5" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-12 left-2 z-50 flex gap-1 rounded-2xl border border-border bg-background p-2 shadow-lg">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setMessageText((prev) => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="rounded-lg p-2 text-lg transition-colors hover:bg-muted"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder="Nhắn tin..."
                  className="h-8 flex-1 border-none bg-transparent text-sm outline-none"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-kyte-blue"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
              </div>
              {messageText.trim() || selectedFiles.length > 0 ? (
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={isSending}
                  className="shrink-0 rounded-full bg-kyte-blue p-2 text-white transition-all disabled:opacity-50"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendMessage(activeRoom?.quick_emoji || '👍')}
                  disabled={isSending}
                  className="shrink-0 rounded-full p-1 text-2xl leading-none transition-colors hover:bg-secondary"
                >
                  {activeRoom?.quick_emoji || '👍'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
