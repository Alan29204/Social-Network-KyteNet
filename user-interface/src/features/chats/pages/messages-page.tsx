import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import {
  Edit,
  Info,
  MoreVertical,
  Search,
  Smile,
  Image as ImageIcon,
  Send,
  Forward,
  Copy,
  Pin,
  Flag,
  Loader2,
  MessageCircle,
  Trash2,
  CornerUpLeft,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useChatRoomsControllerGetListChatRoom,
  useChatMessagesControllerGetMessageHistory,
  useChatMessagesControllerCreateMessage,
  useChatMessagesControllerDeleteMessage,
  useChatRoomsControllerGetOrCreateDirectChat,
  usePinMessagesControllerTogglePinMessage,
  useUsersControllerSearchUsersForMessage,
  chatMessagesControllerGetMessageHistory,
  getChatMessagesControllerGetMessageHistoryQueryKey,
  getChatRoomsControllerGetListChatRoomQueryKey,
} from '@/services/apis/gen/queries';
import { socketService } from '@/services/socket.service';
import { orvalClient } from '@/services/apis/axios-client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { MessagePostCard } from '../components/message-post-card';
import ChatDetailsDrawer from '../components/ChatDetailsDrawer';
import { CreateChatModal } from '../components/CreateChatModal';
import {
  isChatRoomsQueryKey,
  patchChatRoomInCaches,
  removeChatRoomFromCaches,
  updateChatRoomCaches,
  upsertChatRoomInCaches,
} from '../utils/chat-room-cache';
import { getDisplayName, getGroupAvatarUrl, getUserAvatarUrl } from '@/utils/user';

/** 6 fixed reaction emojis (Messenger-style) */
const REACTION_EMOJIS: Record<string, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};

export default function MessagesPage() {
  const { user, accessToken: token } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { roomId: selectedRoomId } = useParams<{ roomId: string }>();
  const selectedRoomIdRef = useRef<string | undefined>(selectedRoomId);
  const userIdRef = useRef<string | undefined>(user?.id);
  const latestMessageIdRef = useRef<string | null>(null);

  // Custom states for premium features
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Virtual chat: user selected from search, no room created yet
  const [virtualRecipient, setVirtualRecipient] = useState<any>(null);
  // Reply state
  const [replyingTo, setReplyingTo] = useState<any>(null);
  // Forward state
  const [forwardingMsg, setForwardingMsg] = useState<any | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    type: 'video' | 'image';
  } | null>(null);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [forwardTargets, setForwardTargets] = useState<string[]>([]);
  const [forwardSearch, setForwardSearch] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'primary' | 'requests'>(
    'primary',
  );
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
    userIdRef.current = user?.id;
  }, [selectedRoomId, user?.id]);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [replyingTo]);

  // Auto clear virtual chat when selecting a real room
  useEffect(() => {
    if (selectedRoomId) {
      setVirtualRecipient(null);
    }
  }, [selectedRoomId]);

  // 1. Fetch Chat Rooms
  const { data: chatRoomsResponse, isLoading: isLoadingRooms } =
    useChatRoomsControllerGetListChatRoom({
      page: 1,
      limit: 50,
      type: selectedTab,
    });
  const chatRooms: any[] = (chatRoomsResponse as any)?.data?.data || [];

  // Danh sách "Tin nhắn đang chờ" (requests) — luôn lấy để biết có tin chưa đọc,
  // hiển thị chấm đỏ trên tab dù đang đứng ở tab nào. (Trùng query-key khi
  // selectedTab === 'requests' nên react-query tự dedupe, không fetch dư.)
  const { data: requestRoomsResponse } = useChatRoomsControllerGetListChatRoom({
    page: 1,
    limit: 50,
    type: 'requests',
  });
  const requestRooms: any[] = (requestRoomsResponse as any)?.data?.data || [];
  const hasUnreadRequests = requestRooms.some(
    (r: any) => (r.unread_count || 0) > 0,
  );

  // 2. Fetch Message History (Query Cache as Source of Truth)
  const { data: messagesResponse } = useChatMessagesControllerGetMessageHistory(
    selectedRoomId as string,
    undefined, // parameters are kept undefined so the cache is keyed solely by room ID
    {
      query: {
        enabled: !!selectedRoomId,
        refetchOnWindowFocus: false,
      },
    },
  );

  const messages: any[] = (messagesResponse as any)?.data?.data || [];
  const hasMore: boolean =
    (messagesResponse as any)?.data?.meta?.has_more || false;

  const createMessageMutation = useChatMessagesControllerCreateMessage();
  const deleteMutation = useChatMessagesControllerDeleteMessage();
  const togglePinMutation = usePinMessagesControllerTogglePinMessage();
  const getOrCreateRoomMutation = useChatRoomsControllerGetOrCreateDirectChat();

  // Search logic (Prefix prioritization + Suggestions)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: searchApiRes, isLoading: isSearchLoading } =
    useUsersControllerSearchUsersForMessage(
      { q: debouncedTerm },
      { query: { enabled: isSearchFocused } },
    );

  const searchedUsers: any[] = (searchApiRes as any)?.data?.data || [];

  // Hybrid search — use chatRooms directly (server-sorted by last_message_at)
  const filteredSearch = useMemo(() => {
    // Normal state (no focus): show active chat rooms list
    if (!isSearchFocused && !searchTerm) {
      return { active: chatRooms, suggested: [], isSearching: false };
    }

    // Input focused but empty: show Recent (active) + Suggested users
    if (!searchTerm) {
      const activeUserIds = new Set(
        chatRooms.map(
          (room: any) => room.members.find((m: any) => m.id !== user?.id)?.id,
        ),
      );

      const suggestedList = searchedUsers.filter(
        (u: any) => !activeUserIds.has(u.id),
      );

      return {
        active: chatRooms,
        suggested: suggestedList,
        isSearching: false,
      };
    }

    // Typing: filter active chats first (Local search)
    const term = searchTerm.toLowerCase();
    const localChats = chatRooms.filter((room: any) => {
      const otherUser = room.members.find((m: any) => m.id !== user?.id);
      return (
        otherUser?.username?.toLowerCase().includes(term) ||
        otherUser?.full_name?.toLowerCase().includes(term)
      );
    });

    // Merge with API search results (Global search), excluding already active chats
    const localUserIds = new Set(
      localChats.map(
        (room: any) => room.members.find((m: any) => m.id !== user?.id)?.id,
      ),
    );
    const globalUsers = searchedUsers.filter(
      (u: any) => !localUserIds.has(u.id),
    );

    return {
      active: localChats,
      suggested: globalUsers,
      isSearching: true,
    };
  }, [searchTerm, isSearchFocused, chatRooms, searchedUsers, user?.id]);

  const updateRoomListCaches = useCallback(
    (updater: (rooms: any[]) => any[]) => {
      updateChatRoomCaches(queryClient, (rooms) => updater(rooms));
    },
    [queryClient],
  );

  const clearRoomUnread = useCallback(
    (roomId: string, readByUserId?: string, clearCurrentRoomCount = false) => {
      updateRoomListCaches((rooms) =>
        rooms.map((room: any) => {
          if (room.id !== roomId) return room;

          return {
            ...room,
            unread_count: clearCurrentRoomCount ? 0 : room.unread_count,
            members: (room.members || room.chat_members || []).map((m: any) =>
              readByUserId && (m.id || m.user_id) === readByUserId
                ? { ...m, unread_count: 0 }
                : m,
            ),
          };
        }),
      );
    },
    [updateRoomListCaches],
  );

  const markRoomAsRead = useCallback(
    (roomId?: string) => {
      if (!roomId || !userIdRef.current) return;
      // Chỉ đánh dấu "đã đọc" khi người dùng ĐANG thực sự xem (tab hiển thị + cửa sổ focus).
      // Tránh báo "Đã xem" sai khi tab ẩn/không focus. Khi user quay lại (visibilitychange/focus)
      // sẽ có listener gọi lại hàm này để đánh dấu đúng lúc.
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;

      clearRoomUnread(roomId, userIdRef.current, true);
      orvalClient({
        url: `/chat-rooms/${roomId}/read`,
        method: 'POST',
      }).catch(console.error);
    },
    [clearRoomUnread],
  );

  // Khi tab quay lại hiển thị / cửa sổ được focus, đánh dấu đã đọc phòng đang mở.
  useEffect(() => {
    const onActive = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        markRoomAsRead(selectedRoomIdRef.current || undefined);
      }
    };
    document.addEventListener('visibilitychange', onActive);
    window.addEventListener('focus', onActive);
    return () => {
      document.removeEventListener('visibilitychange', onActive);
      window.removeEventListener('focus', onActive);
    };
  }, [markRoomAsRead]);

  const updateSidebarWithMessage = useCallback(
    (roomId: string, msg: any) => {
      let shouldInvalidateRooms = false;

      updateRoomListCaches((rooms) => {
        const idx = rooms.findIndex((r: any) => r.id === roomId);
        if (idx === -1) {
          shouldInvalidateRooms = true;
          return rooms;
        }

        const activeRoomId = selectedRoomIdRef.current;
        const currentUserId = userIdRef.current;
        const isActiveRoom = roomId === activeRoomId;
        const isIncoming = msg.created_by !== currentUserId;
        const isOwnDirectMessage =
          rooms[idx].type === 'direct' && msg.created_by === currentUserId;
        const updatedRoom = {
          ...rooms[idx],
          last_message: msg,
          last_message_at: msg.created_at,
          unread_count: isActiveRoom
            ? 0
            : isIncoming
              ? (rooms[idx].unread_count || 0) + 1
              : rooms[idx].unread_count || 0,
          members: (rooms[idx].members || rooms[idx].chat_members || []).map(
            (m: any) => {
              const memberId = m.id || m.user_id;
              if (isActiveRoom && memberId === currentUserId) {
                return { ...m, unread_count: 0 };
              }
              if (isOwnDirectMessage && memberId !== currentUserId) {
                return { ...m, unread_count: Math.max(m.unread_count || 0, 1) };
              }
              return m;
            },
          ),
        };

        const nextRooms = [...rooms];
        nextRooms.splice(idx, 1);
        nextRooms.unshift(updatedRoom);
        return nextRooms;
      });

      if (shouldInvalidateRooms) {
        queryClient.invalidateQueries({
          queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
        });
      }
    },
    [queryClient, updateRoomListCaches],
  );

  // ═══════════════════════════════════════════
  // GLOBAL Socket Listeners (independent of selected room)
  // These listen for events from ALL chat rooms via userId broadcast.
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (!token) return;

    socketService.connect(token);
    const socket = socketService.getSocket();
    if (!socket) return;

    /**
     * newMessage — received when OTHER users send a message to any of your rooms.
     * Updates the message cache for the relevant room and refreshes room list.
     */
    const handleNewMessage = (newMsg: any) => {
      const roomId = newMsg.chat_room_id;
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(roomId),
        (old: any) => {
          if (!old) {
            return {
              data: {
                data: [newMsg],
                meta: { has_more: false, next_cursor: null },
              },
            };
          }
          const currentList = old.data?.data || [];
          // Deduplicate by ID (in case of race conditions)
          const exists = currentList.some((m: any) => m.id === newMsg.id);
          if (exists) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: [...currentList, newMsg],
            },
          };
        },
      );
      // Optimistic sidebar update: move room to top + update last_message
      updateSidebarWithMessage(roomId, newMsg);
      if (
        roomId === selectedRoomIdRef.current &&
        newMsg.created_by !== userIdRef.current
      ) {
        markRoomAsRead(roomId);
      }
    };

    /**
     * messageSaved — confirmation from server after sending text via WebSocket.
     * Maps the temporary optimistic message to the real saved message.
     */
    const handleMessageSaved = (data: { tempId: string; message: any }) => {
      const savedMsg = data.message;
      const roomId = savedMsg.chat_room_id;
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(roomId),
        (old: any) => {
          if (!old) return old;
          const currentList = old.data?.data || [];
          return {
            ...old,
            data: {
              ...old.data,
              data: currentList.some((m: any) => m.id === data.tempId)
                ? currentList.map((m: any) =>
                    m.id === data.tempId ? savedMsg : m,
                  )
                : currentList.some((m: any) => m.id === savedMsg.id)
                  ? currentList
                  : [...currentList, savedMsg],
            },
          };
        },
      );
      // Optimistic sidebar update
      updateSidebarWithMessage(roomId, savedMsg);
    };

    /**
     * messageError — server failed to save a text message sent via WebSocket.
     * Marks the optimistic message as failed.
     */
    const handleMessageError = (data: { tempId: string; error: string }) => {
      // Find which room this temp message belongs to by scanning all caches
      // (tempId is unique across all rooms)
      const queries = queryClient.getQueriesData({
        queryKey: ['/chat-messages'],
      });
      for (const [queryKey, queryData] of queries) {
        const list = (queryData as any)?.data?.data || [];
        const hasTempMsg = list.some((m: any) => m.id === data.tempId);
        if (hasTempMsg) {
          queryClient.setQueryData(queryKey, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              data: {
                ...old.data,
                data: (old.data?.data || []).map((m: any) =>
                  m.id === data.tempId
                    ? { ...m, is_failed: true, is_sending: false }
                    : m,
                ),
              },
            };
          });
          break;
        }
      }
      toast({
        title: 'Lỗi',
        description: data.error || 'Không thể gửi tin nhắn. Vui lòng thử lại.',
        variant: 'destructive',
      });
    };

    /**
     * messageEdited — a message was edited in one of your rooms.
     */
    const handleMessageEdited = (data: any) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.id
                  ? {
                      ...m,
                      message: data.message,
                      message_status: data.message_status,
                    }
                  : m,
              ),
            },
          };
        },
      );
    };

    /**
     * messageDeleted — a message was unsent/deleted in one of your rooms.
     */
    const handleMessageDeleted = (data: any) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.id
                  ? {
                      ...m,
                      ...data,
                      medias: [],
                      pin_messages: [],
                      reply_to_id: null,
                      shared_post_id: null,
                      shared_post: null,
                      reply_to: null,
                      reactions: [],
                    }
                  : m,
              ),
            },
          };
        },
      );
    };

    /**
     * userStatusChanged — a user went online or offline.
     */
    const handleUserStatusChanged = ({
      user_id,
      is_online,
      last_active,
    }: any) => {
      // Update room list cache
      updateRoomListCaches((rooms) =>
        rooms.map((room: any) => ({
          ...room,
          members: (room.members || room.chat_members || []).map((m: any) =>
            (m.id || m.user_id) === user_id
              ? { ...m, is_online, last_active }
              : m,
          ),
        })),
      );
      // Update active header recipient
      setSelectedRecipient((prev: any) => {
        if (prev && prev.id === user_id) {
          return { ...prev, is_online, last_active };
        }
        return prev;
      });
    };

    /**
     * messageReactionUpdated — a reaction was added/removed/changed on a message.
     */
    const handleReactionUpdated = (data: {
      chat_room_id: string;
      message_id: string;
      reactions: any[];
    }) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.message_id
                  ? { ...m, reactions: data.reactions }
                  : m,
              ),
            },
          };
        },
      );
    };

    const handleMessagePinned = (data: {
      messageId: string;
      pinMessage: any;
      chat_room_id: string;
    }) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.messageId
                  ? { ...m, pin_messages: data.pinMessage }
                  : m,
              ),
            },
          };
        },
      );
    };

    const handleMessageUnpinned = (data: {
      messageId: string;
      chat_room_id: string;
    }) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.messageId ? { ...m, pin_messages: null } : m,
              ),
            },
          };
        },
      );
    };

    const handleRoomEmojiUpdated = (data: {
      chat_room_id: string;
      quick_emoji: string;
    }) => {
      patchChatRoomInCaches(queryClient, data.chat_room_id, {
        quick_emoji: data.quick_emoji,
      });
    };

    const handleRoomUpdated = (room: any) => {
      if (!room?.id) return;
      upsertChatRoomInCaches(queryClient, room, userIdRef.current);
    };

    const handleRoomRemoved = (data: { room_id?: string; id?: string }) => {
      const roomId = data.room_id || data.id;
      if (!roomId) return;
      removeChatRoomFromCaches(queryClient, roomId);
      if (selectedRoomIdRef.current === roomId) {
        navigate('/messages');
      }
    };

    /**
     * roomRead — another member read the room.
     */
    const handleRoomRead = (data: {
      chat_room_id: string;
      read_by_user_id: string;
    }) => {
      clearRoomUnread(data.chat_room_id, data.read_by_user_id, false);
    };

    // Register all listeners
    socket.on('newMessage', handleNewMessage);
    socket.on('messageSaved', handleMessageSaved);
    socket.on('messageError', handleMessageError);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('userStatusChanged', handleUserStatusChanged);
    socket.on('messageReactionUpdated', handleReactionUpdated);
    socket.on('messagePinned', handleMessagePinned);
    socket.on('messageUnpinned', handleMessageUnpinned);
    socket.on('roomEmojiUpdated', handleRoomEmojiUpdated);
    socket.on('roomUpdated', handleRoomUpdated);
    socket.on('new_group_chat', handleRoomUpdated);
    socket.on('roomRemoved', handleRoomRemoved);
    socket.on('roomRead', handleRoomRead);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageSaved', handleMessageSaved);
      socket.off('messageError', handleMessageError);
      socket.off('messageEdited', handleMessageEdited);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('userStatusChanged', handleUserStatusChanged);
      socket.off('messageReactionUpdated', handleReactionUpdated);
      socket.off('messagePinned', handleMessagePinned);
      socket.off('messageUnpinned', handleMessageUnpinned);
      socket.off('roomEmojiUpdated', handleRoomEmojiUpdated);
      socket.off('roomUpdated', handleRoomUpdated);
      socket.off('new_group_chat', handleRoomUpdated);
      socket.off('roomRemoved', handleRoomRemoved);
      socket.off('roomRead', handleRoomRead);
    };
  }, [
    token,
    queryClient,
    toast,
    navigate,
    updateSidebarWithMessage,
    markRoomAsRead,
    updateRoomListCaches,
    clearRoomUnread,
  ]);

  // Scroll to bottom: instant on room change, smooth on new messages
  const prevMessagesLenRef = useRef(0);
  const hasScrolledForRoom = useRef<string | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  const isNearBottom = useCallback((threshold = 160) => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  // Reset scroll flag and reply state when switching rooms
  useEffect(() => {
    hasScrolledForRoom.current = null;
    latestMessageIdRef.current = null;
    prevMessagesLenRef.current = 0;
    setShowNewMessagesButton(false);
    setReplyingTo(null);

    if (selectedRoomId && user) {
      markRoomAsRead(selectedRoomId);
    }
  }, [selectedRoomId, user?.id, markRoomAsRead]);

  useEffect(() => {
    if (!selectedRoomId) return;

    if (messages.length === 0) {
      prevMessagesLenRef.current = 0;
      latestMessageIdRef.current = null;
      return;
    }

    const newestMsg = messages[messages.length - 1];
    const newestMsgId = newestMsg?.id || null;
    const previousNewestMsgId = latestMessageIdRef.current;
    const isInitialRoomPaint = hasScrolledForRoom.current !== selectedRoomId;
    const hasNewBottomMessage =
      !!newestMsgId && newestMsgId !== previousNewestMsgId;

    if (isInitialRoomPaint) {
      scrollToBottom('auto');
      hasScrolledForRoom.current = selectedRoomId;
      setShowNewMessagesButton(false);
    } else if (hasNewBottomMessage && !isLoadingMore) {
      if (newestMsg.created_by !== user?.id) {
        markRoomAsRead(selectedRoomId);
      }

      if (newestMsg.created_by === user?.id || isNearBottom(240)) {
        scrollToBottom('smooth');
        setShowNewMessagesButton(false);
      } else {
        setShowNewMessagesButton(true);
      }
    }

    prevMessagesLenRef.current = messages.length;
    latestMessageIdRef.current = newestMsgId;
  }, [
    messages,
    isLoadingMore,
    selectedRoomId,
    user?.id,
    isNearBottom,
    scrollToBottom,
    markRoomAsRead,
  ]);

  // Pagination loader (appending old messages to cache)
  const handleLoadMore = useCallback(async () => {
    if (messages.length > 0 && hasMore && !isLoadingMore && selectedRoomId) {
      const oldestMsg = messages[0];
      if (oldestMsg) {
        const nextCursor = new Date(oldestMsg.created_at).getTime();
        setIsLoadingMore(true);

        // Save scroll position before prepending
        const container = messagesContainerRef.current;
        const prevScrollHeight = container?.scrollHeight || 0;
        const prevScrollTop = container?.scrollTop || 0;

        try {
          const res = await chatMessagesControllerGetMessageHistory(
            selectedRoomId,
            { cursor: nextCursor },
          );
          const newMsgs = (res as any)?.data?.data || [];
          const meta = (res as any)?.data?.meta || {};

          if (newMsgs.length > 0) {
            queryClient.setQueryData(
              getChatMessagesControllerGetMessageHistoryQueryKey(
                selectedRoomId,
              ),
              (old: any) => {
                if (!old) return res;
                return {
                  ...old,
                  data: {
                    ...old.data,
                    data: [...newMsgs, ...(old.data?.data || [])],
                    meta: meta,
                  },
                };
              },
            );
            // Restore scroll position after DOM update
            requestAnimationFrame(() => {
              if (container) {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop =
                  prevScrollTop + (newScrollHeight - prevScrollHeight);
              }
            });
          }
        } catch (error) {
          console.error('Error loading older messages:', error);
        } finally {
          setIsLoadingMore(false);
        }
      }
    }
  }, [messages, hasMore, isLoadingMore, selectedRoomId, queryClient]);

  // IntersectionObserver: auto-load older messages when scrolling to top
  useEffect(() => {
    if (!hasMore || isLoadingMore || !selectedRoomId) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { root: messagesContainerRef.current, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, selectedRoomId, handleLoadMore]);

  // Image & Video Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const picked = Array.from(e.target.files);
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
    }
  };

  /**
   * Send Message Logic (Hybrid: WebSocket for text, REST for media).
   *
   * Text-only messages → WebSocket (fast path, ~50ms latency)
   * Media messages → REST multipart/form-data (supports file upload)
   *
   * Both paths use Optimistic Updates for instant UI feedback.
   */
  const handleSendMessage = async (customMsg?: any) => {
    const isCustomText = typeof customMsg === 'string';
    const msgToUse = isCustomText ? customMsg : messageInput.trim();
    const filesToSend = isCustomText ? [] : [...selectedFiles];

    if (!msgToUse && filesToSend.length === 0) return;
    if (!selectedRoomId && !virtualRecipient) return;

    const msg = msgToUse;
    const hasMedia = filesToSend.length > 0;
    const replyToId = replyingTo?.id;
    const currentReplyTo = replyingTo;

    setMessageInput('');
    setSelectedFiles([]);
    setReplyingTo(null);

    // If in virtual chat mode → create room first, then send
    let targetRoomId = selectedRoomId;
    if (!selectedRoomId && virtualRecipient) {
      try {
        const res = await getOrCreateRoomMutation.mutateAsync({
          targetUserId: virtualRecipient.id,
        });
        const newRoomId = (res as any)?.data?.room_id || (res as any)?.room_id;
        const roomView = (res as any)?.data?.room || (res as any)?.room;
        if (newRoomId) {
          targetRoomId = newRoomId;

          const optimisticRoom = roomView || {
            id: newRoomId,
            type: 'direct',
            name: getDisplayName(virtualRecipient),
            avatar: virtualRecipient.avatar,
            unread_count: 0,
            is_muted: false,
            quick_emoji: '👍',
            is_blocked: false,
            is_request: false,
            last_message: null,
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            members: [
              {
                id: user?.id,
                username: user?.username,
                full_name: user?.full_name,
                avatar: user?.avatar,
                member_type: 'ADMIN',
                status: 'accepted',
                is_online: true,
              },
              {
                id: virtualRecipient.id,
                username: virtualRecipient.username,
                full_name: virtualRecipient.full_name,
                avatar: virtualRecipient.avatar,
                member_type: 'ADMIN',
                status: 'pending',
                is_online: virtualRecipient.is_online,
                last_active: virtualRecipient.last_active,
              },
            ],
          };

          upsertChatRoomInCaches(queryClient, optimisticRoom, user?.id);

          setVirtualRecipient(null);
          setSelectedTab('primary');
          navigate(`/messages/${newRoomId}`);
          // Fall through to the optimistic update + WebSocket send below
        } else {
          return;
        }
      } catch (error: any) {
        console.error(error);
        toast({
          title: 'Không thể nhắn tin',
          description: 'Có lỗi xảy ra khi tạo phòng chat',
          variant: 'destructive',
        });
        setMessageInput(msg); // Restore input
        return;
      }
    }

    if (!targetRoomId) return;

    const tempId = 'temp-' + Date.now();
    const tempMsg = {
      id: tempId,
      chat_room_id: targetRoomId,
      created_by: user?.id,
      message: msg,
      medias: filesToSend.map((file) => URL.createObjectURL(file)),
      created_at: new Date().toISOString(),
      user: user,
      is_sending: true,
      reply_to: currentReplyTo || undefined,
      message_status: 'NORMAL',
    };

    // Step 1: Optimistically write temp message to query cache
    queryClient.setQueryData(
      getChatMessagesControllerGetMessageHistoryQueryKey(targetRoomId),
      (old: any) => {
        if (!old) {
          return {
            data: {
              data: [tempMsg],
              meta: { has_more: false, next_cursor: null },
            },
          };
        }
        return {
          ...old,
          data: {
            ...old.data,
            data: [...(old.data?.data || []), tempMsg],
          },
        };
      },
    );

    if (hasMedia) {
      // ── REST PATH (media upload via multipart/form-data) ──
      updateSidebarWithMessage(targetRoomId, tempMsg);
      createMessageMutation.mutate(
        {
          data: {
            chat_room_id: targetRoomId,
            message: msg,
            'medias-messages': filesToSend as any,
            reply_to_id: replyToId,
          } as any,
        },
        {
          onSuccess: (res: any) => {
            const savedMsg = res?.data || res;
            // Replace temp message with real saved message
            queryClient.setQueryData(
              getChatMessagesControllerGetMessageHistoryQueryKey(targetRoomId),
              (old: any) => {
                if (!old) return old;
                return {
                  ...old,
                  data: {
                    ...old.data,
                    data: (() => {
                      const list = old.data?.data || [];
                      const alreadyHasReal = list.some(
                        (m: any) => m.id === savedMsg.id,
                      );
                      if (alreadyHasReal) {
                        // WebSocket arrived first, just remove the optimistic temp message
                        return list.filter((m: any) => m.id !== tempId);
                      }
                      // REST arrived first, replace temp message with real message
                      return list.some((m: any) => m.id === tempId)
                        ? list.map((m: any) => (m.id === tempId ? savedMsg : m))
                        : [...list, savedMsg];
                    })(),
                  },
                };
              },
            );
            updateSidebarWithMessage(targetRoomId, savedMsg);
          },
          onError: () => {
            // Mark temp message as failed
            queryClient.setQueryData(
              getChatMessagesControllerGetMessageHistoryQueryKey(targetRoomId),
              (old: any) => {
                if (!old) return old;
                return {
                  ...old,
                  data: {
                    ...old.data,
                    data: (old.data?.data || []).map((m: any) =>
                      m.id === tempId
                        ? { ...m, is_failed: true, is_sending: false }
                        : m,
                    ),
                  },
                };
              },
            );
            toast({
              title: 'Lỗi',
              description: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
              variant: 'destructive',
            });
          },
        },
      );
    } else {
      // ── WEBSOCKET PATH (text-only, low-latency) ──
      // Server will respond with 'messageSaved' or 'messageError' events
      const socket = socketService.getSocket();
      if (socket?.connected) {
        socket.emit('sendMessage', {
          chat_room_id: targetRoomId,
          message: msg,
          tempId,
          reply_to_id: replyToId,
        });
        updateSidebarWithMessage(targetRoomId, tempMsg);
      } else {
        // Fallback to REST if socket is disconnected
        updateSidebarWithMessage(targetRoomId, tempMsg);
        createMessageMutation.mutate(
          {
            data: {
              chat_room_id: targetRoomId,
              message: msg,
              reply_to_id: replyToId,
            } as any,
          },
          {
            onSuccess: (res: any) => {
              const savedMsg = res?.data || res;
              queryClient.setQueryData(
                getChatMessagesControllerGetMessageHistoryQueryKey(
                  targetRoomId,
                ),
                (old: any) => {
                  if (!old) return old;
                  return {
                    ...old,
                    data: {
                      ...old.data,
                      data: (old.data?.data || []).map((m: any) =>
                        m.id === tempId ? savedMsg : m,
                      ),
                    },
                  };
                },
              );
            },
            onError: () => {
              queryClient.setQueryData(
                getChatMessagesControllerGetMessageHistoryQueryKey(
                  targetRoomId,
                ),
                (old: any) => {
                  if (!old) return old;
                  return {
                    ...old,
                    data: {
                      ...old.data,
                      data: (old.data?.data || []).map((m: any) =>
                        m.id === tempId
                          ? { ...m, is_failed: true, is_sending: false }
                          : m,
                      ),
                    },
                  };
                },
              );
              toast({
                title: 'Lỗi',
                description: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
                variant: 'destructive',
              });
            },
          },
        );
      }
    }
  };

  // Direct Heart click
  /**
   * Toggle emoji reaction on a message via REST API with optimistic UI update.
   */
  const handleToggleReaction = async (
    messageId: string,
    reactionType: string,
  ) => {
    if (!selectedRoomId) return;
    const queryKey =
      getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId);

    // Snapshot the current cache value
    const previousMessages = queryClient.getQueryData(queryKey);

    // Optimistically update the cache
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old?.data?.data) return old;
      return {
        ...old,
        data: {
          ...old.data,
          data: old.data.data.map((msg: any) => {
            if (msg.id !== messageId) return msg;

            const existingReactions = msg.reactions || [];
            const userReactionIdx = existingReactions.findIndex(
              (r: any) => r.user_id === user?.id,
            );

            let newReactions = [...existingReactions];

            if (userReactionIdx !== -1) {
              const prevReaction = existingReactions[userReactionIdx];
              if (prevReaction.reaction_type === reactionType) {
                // If it is the same reaction, remove it (un-react)
                newReactions.splice(userReactionIdx, 1);
              } else {
                // If it is a different reaction, change the type
                newReactions[userReactionIdx] = {
                  ...prevReaction,
                  reaction_type: reactionType,
                };
              }
            } else {
              // Add a new reaction object
              newReactions.push({
                id: 'temp-reaction-' + Date.now(),
                chat_message_id: messageId,
                user_id: user?.id || '',
                reaction_type: reactionType,
                user: user,
                created_at: new Date().toISOString(),
              });
            }

            return {
              ...msg,
              reactions: newReactions,
            };
          }),
        },
      };
    });

    try {
      await orvalClient(`/chat-messages/${messageId}/reactions`, {
        method: 'POST',
        data: { reaction_type: reactionType },
      });
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Revert cache to previous snapshot on failure
      if (previousMessages) {
        queryClient.setQueryData(queryKey, previousMessages);
      }
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật reaction. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };

  const handleSendQuickEmoji = () => {
    const emoji = activeRoom?.quick_emoji || '👍';
    handleSendMessage(emoji);
  };

  const findDirectRoomForUser = useCallback(
    (targetUserId: string) => {
      const cachedQueries = queryClient.getQueryCache().findAll({
        predicate: (query) => isChatRoomsQueryKey(query.queryKey),
      });
      const candidateLists = [
        chatRooms,
        ...cachedQueries.map((query) => {
          const cached = query.state.data as any;
          return cached?.data?.data || cached?.data || [];
        }),
      ];

      for (const rooms of candidateLists) {
        const room = (Array.isArray(rooms) ? rooms : []).find(
          (item: any) =>
            item.type === 'direct' &&
            item.members?.some((member: any) => member.id === targetUserId),
        );
        if (room) return room;
      }

      return null;
    },
    [chatRooms, queryClient],
  );

  // Selecting a Suggested/Search User — Virtual Room pattern
  const handleSelectUser = useCallback(
    (targetUser: any) => {
      const existingRoom = findDirectRoomForUser(targetUser.id);

      if (existingRoom) {
        // Room exists → just navigate to it
        navigate(`/messages/${existingRoom.id}`);
        setVirtualRecipient(null);
      } else {
        // No room yet → enter virtual chat mode (no DB call, clear URL roomId)
        navigate('/messages');
        setVirtualRecipient(targetUser);
      }
      setSearchTerm('');
      setIsSearchFocused(false);
      setShowCreateChatModal(false);
    },
    [findDirectRoomForUser, navigate],
  );

  const activeRoom = chatRooms.find((r: any) => r.id === selectedRoomId);
  const otherUser =
    activeRoom?.members?.find((m: any) => m.id !== user?.id) ||
    virtualRecipient ||
    selectedRecipient;

  // Whether we're in virtual chat mode (no room created yet)
  const isVirtualChat = !selectedRoomId && !!virtualRecipient;

  // Group chat block warning states
  const [showGroupBlockWarning, setShowGroupBlockWarning] = useState(false);
  const [groupBlockedUser, setGroupBlockedUser] = useState<any>(null);
  const [dismissedGroupWarnings, setDismissedGroupWarnings] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    if (
      activeRoom &&
      activeRoom.type === 'group' &&
      !dismissedGroupWarnings.has(activeRoom.id)
    ) {
      const blockedMember = activeRoom.members?.find((m: any) => m.is_blocked);
      if (blockedMember) {
        setGroupBlockedUser(blockedMember);
        setShowGroupBlockWarning(true);
      } else {
        setShowGroupBlockWarning(false);
        setGroupBlockedUser(null);
      }
    } else {
      setShowGroupBlockWarning(false);
      setGroupBlockedUser(null);
    }
  }, [activeRoom, dismissedGroupWarnings]);

  // Relative Time Formatter
  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'vừa xong';
    if (diffMins < 60) return `${diffMins}ph`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}g`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}n`;
    return format(date, 'd/M');
  };

  // Online / Offline Status Formatter
  const getStatusText = (u: any) => {
    if (!u) return '';
    if (u.is_online) return 'Đang hoạt động';
    if (u.last_active) {
      const date = new Date(u.last_active);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Hoạt động vài giây trước';
      if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      return `Hoạt động ${diffDays} ngày trước`;
    }
    return 'Ngoại tuyến';
  };

  const getMessageActor = (msg: any, room: any = activeRoom) =>
    msg?.user ||
    room?.members?.find(
      (member: any) =>
        member.id === msg?.created_by || member.user_id === msg?.created_by,
    );

  const getSystemMessageText = (msg: any, room: any = activeRoom) => {
    const messageText = msg?.message || '';
    if (messageText.trim().toLowerCase() === 'đã tạo nhóm') {
      return `${getDisplayName(getMessageActor(msg, room))} đã tạo nhóm`;
    }
    return messageText;
  };

  // Helper check for video URLs
  const isVideo = (fileOrUrl: string | File) => {
    const url =
      typeof fileOrUrl === 'string' ? fileOrUrl : (fileOrUrl as any).type;
    return (
      url.includes('video') ||
      ['mp4', 'mov', 'webm', 'ogg', 'mkv', 'avi'].some((ext) =>
        url.toLowerCase().endsWith(ext),
      )
    );
  };

  return (
    <>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Left Sidebar - Chat List */}
        <div className="w-[350px] flex flex-col border-r border-border/40 shrink-0">
          {/* Header */}
          <div className="h-20 flex items-center justify-between px-6 shrink-0 pt-4">
            <div className="flex items-center gap-2 font-bold text-xl cursor-pointer">
              {user?.username || 'Người dùng'}
            </div>
            <button
              onClick={() => setShowCreateChatModal(true)}
              className="p-2 hover:bg-muted/50 rounded-full transition-colors"
            >
              <Edit className="w-6 h-6" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-2 shrink-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="w-full pl-9 pr-4 py-2 bg-muted/50 hover:bg-muted rounded-xl text-sm outline-none transition-colors"
              />
            </div>
          </div>

          {/* Tabs / Header */}
          <div className="flex items-center gap-6 px-6 py-4 shrink-0 border-b border-border/50">
            <button
              onClick={() => setSelectedTab('primary')}
              className={`text-[15px] font-semibold transition-colors ${selectedTab === 'primary' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
            >
              Tin nhắn
            </button>
            <button
              onClick={() => setSelectedTab('requests')}
              className={`relative text-[15px] font-semibold transition-colors ${selectedTab === 'requests' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
            >
              Tin nhắn đang chờ
              {hasUnreadRequests && (
                <span className="absolute -top-1 -right-2.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
            {isLoadingRooms ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {filteredSearch.active.map((room: any) => {
                  const targetUser = room.members.find(
                    (m: any) => m.id !== user?.id,
                  );
                  const isGroup = room.type === 'group';
                  const isActive = room.id === selectedRoomId;
                  const chatName = isGroup
                    ? room.name
                    : getDisplayName(targetUser);

                  return (
                    <div
                      key={room.id}
                      onClick={() => navigate(`/messages/${room.id}`)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-muted/80' : 'hover:bg-muted/50'}`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="w-14 h-14">
                          <AvatarImage
                            src={
                              isGroup
                                ? getGroupAvatarUrl(room.avatar)
                                : getUserAvatarUrl(targetUser)
                            }
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-muted" />
                        </Avatar>
                        {!isGroup &&
                          targetUser?.is_online &&
                          !room.is_blocked && (
                            <span className="absolute bottom-0.5 right-0.5 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
                          )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] truncate">
                          {chatName}
                        </p>
                        <p
                          className={`text-sm truncate ${room.unread_count > 0 ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
                        >
                          {room.last_message
                            ? (
                                room.last_message.message_type ||
                                room.last_message.message_status ||
                                room.last_message.type ||
                                ''
                              ).toLowerCase() === 'system'
                              ? getSystemMessageText(room.last_message, room)
                              : `${room.last_message.created_by === user?.id ? 'Bạn: ' : ''}${room.last_message.message_status === 'deleted' || room.last_message.message_status === 'DELETED' ? 'đã thu hồi một tin nhắn' : room.last_message.message} · ${formatRelativeTime(room.last_message_at)}`
                            : 'Bắt đầu cuộc trò chuyện'}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {filteredSearch.suggested.length > 0 && (
                  <div className="mt-4 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase">
                    {filteredSearch.isSearching ? 'Kết quả khác' : 'Gợi ý'}
                  </div>
                )}

                {isSearchLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  filteredSearch.suggested.map((u: any) => (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <div className="relative shrink-0">
                        <Avatar className="w-14 h-14">
                          <AvatarImage src={getUserAvatarUrl(u)} className="object-cover" />
                          <AvatarFallback className="bg-muted" />
                        </Avatar>
                        {u.is_online && (
                          <span className="absolute bottom-0.5 right-0.5 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] truncate">
                          {getDisplayName(u)}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {filteredSearch.isSearching &&
                  filteredSearch.active.length === 0 &&
                  filteredSearch.suggested.length === 0 &&
                  !isSearchLoading && (
                    <div className="text-center p-6 text-sm text-muted-foreground">
                      Không tìm thấy kết quả nào cho "{searchTerm}"
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {/* Main & Right column wrapper */}
        <div className="flex-1 flex overflow-hidden">
          {/* Right Column - Chat View */}
          <div className="flex-1 flex flex-col bg-background relative overflow-hidden border-r">
            {(selectedRoomId && activeRoom) || isVirtualChat ? (
              <>
                {/* Chat Header */}
                <div className="h-[75px] border-b border-border/40 flex items-center justify-between px-6 shrink-0">
                  <div
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      if (activeRoom?.type === 'group') {
                        setShowInfo(!showInfo);
                      } else {
                        otherUser?.id && navigate(`/profile/${otherUser.id}`);
                      }
                    }}
                  >
                    <div className="relative">
                      <Avatar className="w-11 h-11">
                        <AvatarImage
                          src={
                            activeRoom?.type === 'group'
                              ? getGroupAvatarUrl(activeRoom.avatar)
                              : getUserAvatarUrl(otherUser)
                          }
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-muted" />
                      </Avatar>
                      {activeRoom?.type !== 'group' &&
                        otherUser?.is_online &&
                        !activeRoom?.is_blocked && (
                          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                        )}
                    </div>
                    <div>
                      <p className="font-bold text-base">
                        {activeRoom?.type === 'group'
                          ? activeRoom.name
                          : getDisplayName(otherUser)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeRoom?.type === 'group'
                          ? `${activeRoom.members?.length || 0} thành viên`
                          : getStatusText(otherUser)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-foreground">
                    <button
                      onClick={() => setShowInfo((prev) => !prev)}
                      className={`hover:opacity-75 p-2 rounded-full transition-colors ${showInfo ? 'bg-muted text-[#0084ff]' : ''}`}
                      title="Thông tin chi tiết"
                    >
                      <Info className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Pinned Messages Banner */}
                {(() => {
                  const pinnedMessages = messages.filter(
                    (m: any) =>
                      m.pin_messages &&
                      (Array.isArray(m.pin_messages)
                        ? m.pin_messages.length > 0
                        : true),
                  );
                  if (pinnedMessages.length === 0) return null;

                  if (pinnedMessages.length === 1 || !isPinnedExpanded) {
                    const latestPinned =
                      pinnedMessages[pinnedMessages.length - 1];
                    const isMediaOnly =
                      !latestPinned.message &&
                      latestPinned.medias &&
                      latestPinned.medias.length > 0;
                    return (
                      <div className="bg-muted/30 border-b border-border/40 px-6 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
                        <div
                          className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            const el = document.getElementById(
                              `msg-${latestPinned.id}`,
                            );
                            if (el) {
                              el.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                              });
                              el.classList.add('bg-muted/50');
                              setTimeout(
                                () => el.classList.remove('bg-muted/50'),
                                2000,
                              );
                            }
                          }}
                        >
                          <Pin className="w-3.5 h-3.5 rotate-45 text-amber-500 fill-amber-500 shrink-0" />
                          <span className="text-xs font-semibold truncate flex items-center gap-1">
                            {pinnedMessages.length} tin nhắn được ghim:
                            {isMediaOnly ? (
                              <>
                                <ImageIcon className="w-3 h-3 text-muted-foreground" />{' '}
                                Hình ảnh/Video
                              </>
                            ) : (
                              latestPinned.message
                            )}
                          </span>
                        </div>
                        {pinnedMessages.length > 1 && (
                          <button
                            onClick={() => setIsPinnedExpanded(true)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="bg-muted/30 border-b border-border/40 flex flex-col shadow-sm z-10 shrink-0 relative">
                      <div className="flex items-center justify-between px-6 py-2">
                        <div className="text-xs font-semibold flex items-center gap-2">
                          <Pin className="w-3.5 h-3.5 rotate-45 text-amber-500 fill-amber-500 shrink-0" />
                          {pinnedMessages.length} tin nhắn được ghim
                        </div>
                        <button
                          onClick={() => setIsPinnedExpanded(false)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="px-6 pb-2 flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                        {pinnedMessages.map((m: any) => {
                          const isMediaOnly =
                            !m.message && m.medias && m.medias.length > 0;
                          return (
                            <div
                              key={m.id}
                              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                              onClick={() => {
                                const el = document.getElementById(
                                  `msg-${m.id}`,
                                );
                                if (el) {
                                  el.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center',
                                  });
                                  el.classList.add('bg-muted/50');

                                  setTimeout(
                                    () => el.classList.remove('bg-muted/50'),
                                    2000,
                                  );
                                }
                                setIsPinnedExpanded(false);
                              }}
                            >
                              <div className="w-1 h-full bg-amber-500 rounded-full" />
                              <div className="text-xs truncate flex-1 flex items-center gap-1">
                                <span className="font-semibold text-muted-foreground mr-1 shrink-0">
                                  {getDisplayName(m.user, 'Người dùng')}:
                                </span>
                                {isMediaOnly ? (
                                  <>
                                    <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />{' '}
                                    Hình ảnh/Video
                                  </>
                                ) : (
                                  <span className="truncate">{m.message}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Chat Messages Container */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 flex flex-col relative"
                  onScroll={() => {
                    if (isNearBottom()) {
                      setShowNewMessagesButton(false);
                    }
                  }}
                >
                  {/* Infinite scroll sentinel — triggers auto-load when visible at top */}
                  <div ref={loadMoreSentinelRef} className="h-1 shrink-0" />
                  {isLoadingMore && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {/* Avatar introduction — shown before the oldest loaded message */}
                  {!hasMore && (
                    <div className="flex flex-col items-center justify-center pt-8 pb-12 gap-3">
                      {activeRoom?.type === 'group' ? (
                        <>
                          <Avatar className="w-24 h-24">
                            <AvatarImage
                              src={getGroupAvatarUrl(activeRoom.avatar)}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-muted" />
                          </Avatar>
                          <h2 className="text-xl font-bold">
                            {activeRoom.name}
                          </h2>
                          <p className="text-muted-foreground text-sm">
                            {activeRoom.members?.length} thành viên
                          </p>
                        </>
                      ) : (
                        <>
                          <Avatar className="w-24 h-24">
                            <AvatarImage
                              src={getUserAvatarUrl(otherUser)}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-muted" />
                          </Avatar>
                          <h2 className="text-xl font-bold">
                            {getDisplayName(otherUser)}
                          </h2>
                          <button
                            className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg font-semibold text-sm hover:bg-secondary/80 transition-colors mt-2"
                            onClick={() =>
                              otherUser?.id &&
                              navigate(`/profile/${otherUser.id}`)
                            }
                          >
                            Xem trang cá nhân
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Messages Mapping — Instagram/Messenger-style connected bubbles */}
                  {(() => {
                    const targetUser = activeRoom?.members?.find(
                      (m: any) => m.id !== user?.id,
                    );
                    const latestMineMessage = [...messages]
                      .reverse()
                      .find(
                        (m: any) =>
                          m.created_by === user?.id &&
                          m.message_status !== 'system' &&
                          m.message_status !== 'SYSTEM' &&
                          m.message_status !== 'deleted' &&
                          m.message_status !== 'DELETED',
                      );
                    const isGroupableMessage = (item: any) =>
                      item &&
                      item.message_status !== 'system' &&
                      item.message_status !== 'SYSTEM' &&
                      item.message_status !== 'deleted' &&
                      item.message_status !== 'DELETED';
                    const isWithinGroupWindow = (a: any, b: any) =>
                      Math.abs(
                        new Date(a.created_at).getTime() -
                          new Date(b.created_at).getTime(),
                      ) <=
                      5 * 60 * 1000;

                    return messages.map((msg: any, idx: number) => {
                      const isMine = msg.created_by === user?.id;
                      const sender =
                        msg.user ||
                        activeRoom?.members?.find(
                          (m: any) => m.id === msg.created_by,
                        ) ||
                        otherUser;
                      const prevMsg = idx > 0 ? messages[idx - 1] : null;
                      const nextMsg =
                        idx < messages.length - 1 ? messages[idx + 1] : null;
                      const isSameSenderAsPrev =
                        prevMsg &&
                        prevMsg.created_by === msg.created_by &&
                        isGroupableMessage(prevMsg) &&
                        isGroupableMessage(msg) &&
                        isWithinGroupWindow(prevMsg, msg);
                      const isSameSenderAsNext =
                        nextMsg &&
                        nextMsg.created_by === msg.created_by &&
                        isGroupableMessage(nextMsg) &&
                        isGroupableMessage(msg) &&
                        isWithinGroupWindow(nextMsg, msg);
                      const showAvatar = !isMine && !isSameSenderAsNext;
                      const shouldShowOwnStatus =
                        isMine && latestMineMessage?.id === msg.id;

                      // Time separator: show if >5 min gap from previous message
                      const showTimeSeparator = (() => {
                        if (!prevMsg) return false;
                        const prev = new Date(prevMsg.created_at).getTime();
                        const curr = new Date(msg.created_at).getTime();
                        return curr - prev > 5 * 60 * 1000; // 5 minutes
                      })();

                      // Emoji-only detection: message with only emoji/whitespace, no media
                      const isEmojiOnly = (() => {
                        if (
                          !msg.message ||
                          (msg.medias && msg.medias.length > 0)
                        )
                          return false;
                        const emojiRegex =
                          /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]+$/u;
                        return (
                          emojiRegex.test(msg.message) &&
                          msg.message.trim().length <= 8
                        );
                      })();

                      // ─── Connected Bubble Border-Radius (Messenger-style) ───
                      // 18px = fully rounded, 4px = "connected" edge
                      const R = '18px';
                      const r = '4px';
                      let bubbleRadius: string;

                      if (isMine) {
                        // Right-aligned: "connected" edge is on the RIGHT side
                        if (isSameSenderAsPrev && isSameSenderAsNext) {
                          // Middle of group
                          bubbleRadius = `${R} ${r} ${r} ${R}`;
                        } else if (isSameSenderAsPrev && !isSameSenderAsNext) {
                          // Last in group (bottom)
                          bubbleRadius = `${R} ${r} ${R} ${R}`;
                        } else if (!isSameSenderAsPrev && isSameSenderAsNext) {
                          // First in group (top)
                          bubbleRadius = `${R} ${R} ${r} ${R}`;
                        } else {
                          // Solo message
                          bubbleRadius = `${R} ${R} ${R} ${R}`;
                        }
                      } else {
                        // Left-aligned: "connected" edge is on the LEFT side
                        if (isSameSenderAsPrev && isSameSenderAsNext) {
                          bubbleRadius = `${r} ${R} ${R} ${r}`;
                        } else if (isSameSenderAsPrev && !isSameSenderAsNext) {
                          bubbleRadius = `${r} ${R} ${R} ${R}`;
                        } else if (!isSameSenderAsPrev && isSameSenderAsNext) {
                          bubbleRadius = `${R} ${R} ${R} ${r}`;
                        } else {
                          bubbleRadius = `${R} ${R} ${R} ${R}`;
                        }
                      }
                      // Reset radius grouping if time separator is shown
                      if (showTimeSeparator) {
                        if (isSameSenderAsNext) {
                          bubbleRadius = isMine
                            ? `${R} ${R} ${r} ${R}`
                            : `${R} ${R} ${R} ${r}`;
                        } else {
                          bubbleRadius = `${R} ${R} ${R} ${R}`;
                        }
                      }

                      if (
                        msg.message_status === 'system' ||
                        msg.message_status === 'SYSTEM'
                      ) {
                        return (
                          <div key={msg.id} id={`msg-${msg.id}`}>
                            {showTimeSeparator && (
                              <div className="flex justify-center py-4">
                                <span className="text-[11px] text-muted-foreground font-medium px-3 py-0.5 rounded-full bg-muted/60">
                                  {format(new Date(msg.created_at), 'HH:mm')}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-center py-2">
                              <span className="text-[12px] text-muted-foreground font-medium px-4 py-1 rounded-full bg-muted/40 text-center">
                                {getSystemMessageText(msg)}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      if (
                        msg.message_status === 'deleted' ||
                        msg.message_status === 'DELETED'
                      ) {
                        return (
                          <div
                            key={msg.id}
                            id={`msg-${msg.id}`}
                            className="transition-colors duration-500 rounded-xl px-1 -mx-1"
                          >
                            {/* Time separator */}
                            {showTimeSeparator && (
                              <div className="flex justify-center py-4">
                                <span className="text-[11px] text-muted-foreground font-medium px-3 py-0.5 rounded-full bg-muted/60">
                                  {format(new Date(msg.created_at), 'HH:mm')}
                                </span>
                              </div>
                            )}
                            <div
                              className={`flex items-end gap-2 group ${isMine ? 'justify-end' : ''}`}
                              style={{
                                marginTop: showTimeSeparator
                                  ? '4px'
                                  : isSameSenderAsPrev
                                    ? '2px'
                                    : '12px',
                              }}
                            >
                              {!isMine &&
                                (showAvatar ? (
                                  <Avatar className="w-7 h-7 shrink-0 opacity-50">
                                    <AvatarImage src={getUserAvatarUrl(sender)} className="object-cover" />
                                    <AvatarFallback className="bg-muted" />
                                  </Avatar>
                                ) : (
                                  <div className="w-7 shrink-0" />
                                ))}
                              <div className="px-3 py-1.5 text-[14px] italic border border-border/80 text-muted-foreground rounded-2xl bg-transparent select-none">
                                {isMine
                                  ? 'Bạn đã thu hồi một tin nhắn'
                                  : `${getDisplayName(sender)} đã thu hồi một tin nhắn`}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          id={`msg-${msg.id}`}
                          className="transition-colors duration-500 rounded-xl px-1 -mx-1"
                        >
                          {/* Time separator */}
                          {showTimeSeparator && (
                            <div className="flex justify-center py-4">
                              <span className="text-[11px] text-muted-foreground font-medium px-3 py-0.5 rounded-full bg-muted/60">
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </span>
                            </div>
                          )}

                          <div
                            className={`flex items-end gap-2 group ${isMine ? 'justify-end' : ''}`}
                            style={{
                              marginTop: showTimeSeparator
                                ? '4px'
                                : isSameSenderAsPrev
                                  ? '2px'
                                  : '12px',
                              marginBottom:
                                msg.reactions && msg.reactions.length > 0
                                  ? '10px'
                                  : '0px',
                            }}
                          >
                            {/* Avatar: show on last message of group, spacer otherwise */}
                            {!isMine &&
                              (showAvatar ? (
                                <Avatar className="w-7 h-7 shrink-0">
                                  <AvatarImage src={getUserAvatarUrl(sender)} className="object-cover" />
                                  <AvatarFallback className="bg-muted" />
                                </Avatar>
                              ) : (
                                <div className="w-7 shrink-0" />
                              ))}

                            {/* Context menu + quick actions for own messages */}
                            {isMine && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                                {/* Quick reaction picker */}
                                <div className="flex items-center bg-background border border-border/50 rounded-full px-1 py-0.5 shadow-sm mr-0.5">
                                  {Object.entries(REACTION_EMOJIS).map(
                                    ([type, emoji]) => (
                                      <button
                                        key={type}
                                        className="text-xs hover:scale-125 transition-transform p-0.5"
                                        title={type}
                                        onClick={() =>
                                          handleToggleReaction(msg.id, type)
                                        }
                                      >
                                        {emoji}
                                      </button>
                                    ),
                                  )}
                                </div>
                                <button
                                  className="p-1.5 hover:bg-muted rounded-full transition-colors"
                                  title="Trả lời"
                                  onClick={() => setReplyingTo(msg)}
                                >
                                  <CornerUpLeft className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <div className="cursor-pointer p-1">
                                      <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                    </div>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-48 rounded-xl"
                                  >
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center border-b mb-1">
                                      {format(
                                        new Date(msg.created_at),
                                        'HH:mm',
                                      )}
                                    </div>
                                    <DropdownMenuItem
                                      className="cursor-pointer flex justify-between py-2 rounded-lg"
                                      onClick={() => setForwardingMsg(msg)}
                                    >
                                      Chuyển tiếp{' '}
                                      <Forward className="w-4 h-4 ml-2" />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                                      Sao chép <Copy className="w-4 h-4 ml-2" />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer flex justify-between py-2 rounded-lg"
                                      onClick={() =>
                                        togglePinMutation.mutate(
                                          { messageId: msg.id },
                                          {
                                            onSuccess: (res: any) => {
                                              const action =
                                                res?.data?.action ||
                                                res?.action;
                                              const pinMessage =
                                                res?.data?.pinMessage ||
                                                res?.pinMessage;
                                              queryClient.setQueryData(
                                                getChatMessagesControllerGetMessageHistoryQueryKey(
                                                  selectedRoomId!,
                                                ),
                                                (old: any) => {
                                                  if (!old) return old;
                                                  return {
                                                    ...old,
                                                    data: {
                                                      ...old.data,
                                                      data: (
                                                        old.data?.data || []
                                                      ).map((m: any) =>
                                                        m.id === msg.id
                                                          ? {
                                                              ...m,
                                                              pin_messages:
                                                                action ===
                                                                'pinned'
                                                                  ? pinMessage
                                                                  : null,
                                                            }
                                                          : m,
                                                      ),
                                                    },
                                                  };
                                                },
                                              );
                                            },
                                            onError: (error: any) => {
                                              if (
                                                error?.response?.status === 400
                                              ) {
                                                toast({
                                                  title: 'Không thể ghim',
                                                  description:
                                                    error.response?.data
                                                      ?.message ||
                                                    'Bạn chỉ có thể ghim tối đa 3 tin nhắn',
                                                  variant: 'destructive',
                                                });
                                              }
                                            },
                                          },
                                        )
                                      }
                                    >
                                      {msg.pin_messages &&
                                      (Array.isArray(msg.pin_messages)
                                        ? msg.pin_messages.length > 0
                                        : true)
                                        ? 'Bỏ Ghim'
                                        : 'Ghim'}{' '}
                                      <Pin className="w-4 h-4 ml-2" />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer flex justify-between py-2 text-destructive focus:text-destructive rounded-lg"
                                      onClick={() => {
                                        queryClient.setQueryData(
                                          getChatMessagesControllerGetMessageHistoryQueryKey(
                                            selectedRoomId!,
                                          ),
                                          (old: any) => {
                                            if (!old) return old;
                                            return {
                                              ...old,
                                              data: {
                                                ...old.data,
                                                data: (
                                                  old.data?.data || []
                                                ).map((m: any) =>
                                                  m.id === msg.id
                                                    ? {
                                                        ...m,
                                                        message_status:
                                                          'deleted',
                                                        message: '',
                                                        medias: [],
                                                        reply_to_id: null,
                                                        shared_post_id: null,
                                                        pin_messages: [],
                                                      }
                                                    : m,
                                                ),
                                              },
                                            };
                                          },
                                        );
                                        deleteMutation.mutate({ id: msg.id });
                                      }}
                                    >
                                      Thu hồi{' '}
                                      <Trash2 className="w-4 h-4 ml-2" />
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}

                            {/* Message content */}
                            <div
                              onDoubleClick={handleSendQuickEmoji}
                              className="relative flex flex-col max-w-[60%] select-none cursor-pointer"
                            >
                              {/* Pinned badge */}
                              {msg.pin_messages &&
                                (Array.isArray(msg.pin_messages)
                                  ? msg.pin_messages.length > 0
                                  : true) && (
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground self-start pl-1 mb-0.5">
                                    <Pin className="w-3 h-3 rotate-45 text-amber-500 fill-amber-500" />{' '}
                                    Đã ghim
                                  </div>
                                )}

                              {/* Quoted reply preview */}
                              {msg.reply_to && (
                                <>
                                  {/* Reply Header */}
                                  <span
                                    className={`text-[11px] text-muted-foreground/80 mb-0.5 ${isMine ? 'self-end text-right' : 'self-start text-left'}`}
                                  >
                                    {isMine
                                      ? msg.reply_to.created_by === user?.id
                                        ? 'Bạn đã trả lời chính bạn'
                                        : `Bạn đã trả lời ${getDisplayName(msg.reply_to.user, 'người dùng')}`
                                      : `${getDisplayName(msg.user)} đã trả lời ${
                                          msg.reply_to.created_by === user?.id
                                            ? 'bạn'
                                            : getDisplayName(msg.reply_to.user, 'người dùng')
                                        }`}
                                  </span>
                                  {/* Quoted Bubble */}
                                  <div
                                    onClick={() => {
                                      const el = document.getElementById(
                                        `msg-${msg.reply_to.id}`,
                                      );
                                      if (el) {
                                        el.scrollIntoView({
                                          behavior: 'smooth',
                                          block: 'center',
                                        });
                                        el.classList.add(
                                          'bg-muted/50',
                                          'transition-colors',
                                          'duration-500',
                                        );
                                        setTimeout(() => {
                                          el.classList.remove('bg-muted/50');
                                        }, 2000);
                                      }
                                    }}
                                    className={`px-3 py-1.5 bg-muted/60 dark:bg-muted/40 text-muted-foreground text-xs rounded-xl mb-1 max-w-[85%] cursor-pointer hover:bg-muted/80 transition-colors flex items-center gap-2 ${
                                      isMine ? 'self-end' : 'self-start'
                                    }`}
                                  >
                                    {msg.reply_to.message_status ===
                                    'deleted' ? (
                                      <span className="truncate">
                                        Tin nhắn đã thu hồi
                                      </span>
                                    ) : msg.reply_to.shared_post_id ? (
                                      <>
                                        <ImageIcon className="w-3 h-3 shrink-0" />
                                        <span className="truncate">
                                          Bài viết của{' '}
                                          {msg.reply_to.shared_post?.user
                                            ? getDisplayName(msg.reply_to.shared_post.user, 'người dùng')
                                            : 'người dùng'}
                                        </span>
                                        {msg.reply_to.shared_post
                                          ?.medias?.[0] && (
                                          <img
                                            src={
                                              msg.reply_to.shared_post.medias[0].startsWith(
                                                'http',
                                              ) ||
                                              msg.reply_to.shared_post.medias[0].startsWith(
                                                'blob:',
                                              )
                                                ? msg.reply_to.shared_post
                                                    .medias[0]
                                                : `${import.meta.env.VITE_MEDIA_URL}/${msg.reply_to.shared_post.medias[0]}`
                                            }
                                            alt="thumbnail"
                                            className="w-6 h-6 object-cover rounded shrink-0"
                                          />
                                        )}
                                      </>
                                    ) : msg.reply_to.medias &&
                                      msg.reply_to.medias.length > 0 &&
                                      !msg.reply_to.message ? (
                                      (() => {
                                        const rawUrl = msg.reply_to.medias[0];
                                        const fullUrl =
                                          rawUrl.startsWith('http') ||
                                          rawUrl.startsWith('blob:')
                                            ? rawUrl
                                            : `${import.meta.env.VITE_MEDIA_URL}/${rawUrl}`;
                                        return isVideo(rawUrl) ? (
                                          <video
                                            src={fullUrl}
                                            className="w-10 h-10 object-cover rounded shrink-0"
                                          />
                                        ) : (
                                          <img
                                            src={fullUrl}
                                            alt="thumbnail"
                                            className="w-10 h-10 object-cover rounded shrink-0"
                                          />
                                        );
                                      })()
                                    ) : (
                                      <span className="truncate line-clamp-2">
                                        {msg.reply_to.message}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Shared Post Card */}
                              {msg.shared_post_id && (
                                <div
                                  className={`mt-1 mb-1 ${msg.is_sending ? 'opacity-70' : ''}`}
                                >
                                  <MessagePostCard post={msg.shared_post} />
                                </div>
                              )}

                              {/* Media attachments */}
                              {msg.medias && msg.medias.length > 0 && (
                                <div
                                  className={`grid gap-1 overflow-hidden ${
                                    msg.medias.length > 1
                                      ? 'grid-cols-2'
                                      : 'grid-cols-1'
                                  } ${msg.is_sending ? 'opacity-70' : ''}`}
                                  style={{ borderRadius: bubbleRadius }}
                                >
                                  {msg.medias.map(
                                    (url: string, mediaIdx: number) => {
                                      const fullUrl =
                                        url.startsWith('http') ||
                                        url.startsWith('blob:')
                                          ? url
                                          : `http://localhost:3000${url}`;
                                      const isVideoMedia = isVideo(url);

                                      return isVideoMedia ? (
                                        <video
                                          key={mediaIdx}
                                          src={fullUrl}
                                          controls
                                          className="max-h-60 w-full object-cover"
                                        />
                                      ) : (
                                        <img
                                          key={mediaIdx}
                                          src={fullUrl}
                                          alt="attachment"
                                          loading="lazy"
                                          className="max-h-60 w-full object-cover hover:opacity-90 transition-opacity"
                                          onClick={() =>
                                            setPreviewMedia({
                                              url: fullUrl,
                                              type: isVideoMedia
                                                ? 'video'
                                                : 'image',
                                            })
                                          }
                                        />
                                      );
                                    },
                                  )}
                                </div>
                              )}

                              {/* Text bubble with connected border-radius */}
                              {msg.message &&
                                (isEmojiOnly ? (
                                  /* Large emoji without bubble */
                                  <div
                                    className={`text-4xl py-1 ${msg.is_sending ? 'opacity-70' : ''}`}
                                  >
                                    {msg.message}
                                  </div>
                                ) : (
                                  <div
                                    className={`px-3 py-2 text-[15px] leading-[20px] relative w-fit ${
                                      isMine
                                        ? 'bg-[#0084ff] text-white self-end'
                                        : 'bg-muted text-foreground self-start'
                                    } ${msg.is_sending ? 'opacity-70' : ''} ${
                                      msg.is_failed
                                        ? 'bg-red-500 text-white'
                                        : ''
                                    }`}
                                    style={{ borderRadius: bubbleRadius }}
                                  >
                                    {msg.message}
                                    {msg.is_failed && (
                                      <span className="absolute bottom-0.5 right-2 text-[8px] text-white font-bold">
                                        lỗi
                                      </span>
                                    )}
                                  </div>
                                ))}

                              {/* Reaction badges (optimistic overlay) */}
                              {msg.reactions && msg.reactions.length > 0 && (
                                <div
                                  className={`absolute -bottom-2.5 z-10 ${isMine ? 'right-2' : 'left-2'}`}
                                >
                                  <div className="inline-flex items-center gap-0.5 bg-background border border-border/50 rounded-full px-1.5 py-0.5 shadow-sm text-xs cursor-pointer hover:scale-110 transition-transform">
                                    {Object.entries(
                                      msg.reactions.reduce(
                                        (
                                          acc: Record<string, number>,
                                          r: any,
                                        ) => {
                                          acc[r.reaction_type] =
                                            (acc[r.reaction_type] || 0) + 1;
                                          return acc;
                                        },
                                        {},
                                      ),
                                    ).map(([type, count]) => (
                                      <span key={type} title={type}>
                                        {REACTION_EMOJIS[type] || type}
                                        {(count as number) > 1
                                          ? ` ${count}`
                                          : ''}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Message Status Indicators */}
                              {shouldShowOwnStatus && (
                                <div
                                  className={`mt-1 min-h-4 text-right text-[11px] ${
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
                                          targetUser?.unread_count === 0
                                        ? 'Đã xem'
                                        : 'Đã gửi'}
                                </div>
                              )}
                            </div>

                            {!isMine && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                                {/* Quick reaction picker */}
                                <div className="flex items-center bg-background border border-border/50 rounded-full px-1 py-0.5 shadow-sm mr-0.5">
                                  {Object.entries(REACTION_EMOJIS).map(
                                    ([type, emoji]) => (
                                      <button
                                        key={type}
                                        className="text-xs hover:scale-125 transition-transform p-0.5"
                                        title={type}
                                        onClick={() =>
                                          handleToggleReaction(msg.id, type)
                                        }
                                      >
                                        {emoji}
                                      </button>
                                    ),
                                  )}
                                </div>
                                <button
                                  className="p-1.5 hover:bg-muted rounded-full transition-colors"
                                  title="Trả lời"
                                  onClick={() => setReplyingTo(msg)}
                                >
                                  <CornerUpLeft className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer p-1">
                                      <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                    </div>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="start"
                                    className="w-48 rounded-xl"
                                  >
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center border-b mb-1">
                                      {format(
                                        new Date(msg.created_at),
                                        'HH:mm',
                                      )}
                                    </div>
                                    <DropdownMenuItem
                                      className="cursor-pointer flex justify-between py-2 rounded-lg"
                                      onClick={() => setForwardingMsg(msg)}
                                    >
                                      Chuyển tiếp{' '}
                                      <Forward className="w-4 h-4 ml-2" />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                                      Sao chép <Copy className="w-4 h-4 ml-2" />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer flex justify-between py-2 rounded-lg"
                                      onClick={() =>
                                        togglePinMutation.mutate(
                                          { messageId: msg.id },
                                          {
                                            onSuccess: (res: any) => {
                                              const action =
                                                res?.data?.action ||
                                                res?.action;
                                              const pinMessage =
                                                res?.data?.pinMessage ||
                                                res?.pinMessage;
                                              queryClient.setQueryData(
                                                getChatMessagesControllerGetMessageHistoryQueryKey(
                                                  selectedRoomId!,
                                                ),
                                                (old: any) => {
                                                  if (!old) return old;
                                                  return {
                                                    ...old,
                                                    data: {
                                                      ...old.data,
                                                      data: (
                                                        old.data?.data || []
                                                      ).map((m: any) =>
                                                        m.id === msg.id
                                                          ? {
                                                              ...m,
                                                              pin_messages:
                                                                action ===
                                                                'pinned'
                                                                  ? pinMessage
                                                                  : null,
                                                            }
                                                          : m,
                                                      ),
                                                    },
                                                  };
                                                },
                                              );
                                            },
                                            onError: (error: any) => {
                                              if (
                                                error?.response?.status === 400
                                              ) {
                                                toast({
                                                  title: 'Không thể ghim',
                                                  description:
                                                    error.response?.data
                                                      ?.message ||
                                                    'Bạn chỉ có thể ghim tối đa 3 tin nhắn',
                                                  variant: 'destructive',
                                                });
                                              }
                                            },
                                          },
                                        )
                                      }
                                    >
                                      {msg.pin_messages &&
                                      (Array.isArray(msg.pin_messages)
                                        ? msg.pin_messages.length > 0
                                        : true)
                                        ? 'Bỏ Ghim'
                                        : 'Ghim'}{' '}
                                      <Pin className="w-4 h-4 ml-2" />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer flex justify-between py-2 text-destructive focus:text-destructive rounded-lg">
                                      Báo cáo <Flag className="w-4 h-4 ml-2" />
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {showNewMessagesButton && (
                    <button
                      className="sticky bottom-3 z-20 self-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg"
                      onClick={() => {
                        scrollToBottom('smooth');
                        setShowNewMessagesButton(false);
                        if (selectedRoomId) {
                          markRoomAsRead(selectedRoomId);
                        }
                      }}
                    >
                      Tin nhắn mới
                    </button>
                  )}
                  <div ref={messagesEndRef} className="h-1 shrink-0" />
                </div>

                {/* Previews of selected files */}
                {selectedFiles.length > 0 && (
                  <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto border-t border-border/40 shrink-0 bg-background/50">
                    {selectedFiles.map((file, idx) => {
                      const url = URL.createObjectURL(file);
                      const isVideoFile = file.type.startsWith('video');
                      return (
                        <div
                          key={idx}
                          className="relative w-16 h-16 rounded-xl overflow-hidden border border-border shrink-0 bg-muted group"
                        >
                          {isVideoFile ? (
                            <video
                              src={url}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={url}
                              alt="preview"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedFiles((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="absolute top-1 right-1 bg-black/75 hover:bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply bar */}
                {replyingTo && (
                  <div className="px-4 py-2 border-t border-border/40 bg-muted/30 flex items-center gap-3 shrink-0 animate-in slide-in-from-bottom-1 duration-150">
                    <div className="w-1 h-10 bg-[#0084ff] rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 flex justify-between items-center pr-2">
                      <div className="flex flex-col min-w-0">
                        <p className="text-xs font-semibold text-[#0084ff]">
                          Đang trả lời{' '}
                          {replyingTo.user?.id === user?.id
                            ? 'chính bạn'
                            : getDisplayName(replyingTo.user, 'người dùng')}
                        </p>
                        {replyingTo.shared_post_id ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">
                              Bài viết của{' '}
                              {replyingTo.shared_post?.user
                                ? getDisplayName(replyingTo.shared_post.user, 'người dùng')
                                : 'người dùng'}
                            </span>
                          </div>
                        ) : replyingTo.medias &&
                          replyingTo.medias.length > 0 &&
                          !replyingTo.message ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">
                              {isVideo(replyingTo.medias[0])
                                ? 'Video'
                                : 'Hình ảnh'}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground truncate">
                            {replyingTo.message}
                          </p>
                        )}
                      </div>
                      {replyingTo.shared_post_id &&
                      replyingTo.shared_post?.medias?.[0] ? (
                        <img
                          src={
                            replyingTo.shared_post.medias[0].startsWith(
                              'http',
                            ) ||
                            replyingTo.shared_post.medias[0].startsWith('blob:')
                              ? replyingTo.shared_post.medias[0]
                              : `${import.meta.env.VITE_MEDIA_URL}/${replyingTo.shared_post.medias[0]}`
                          }
                          className="w-9 h-9 object-cover rounded shrink-0"
                          alt="reply-thumb"
                        />
                      ) : (
                        replyingTo.medias &&
                        replyingTo.medias.length > 0 &&
                        (() => {
                          const rawUrl = replyingTo.medias[0];
                          const fullUrl =
                            rawUrl.startsWith('http') ||
                            rawUrl.startsWith('blob:')
                              ? rawUrl
                              : `${import.meta.env.VITE_MEDIA_URL}/${rawUrl}`;
                          return isVideo(rawUrl) ? (
                            <video
                              src={fullUrl}
                              className="w-9 h-9 object-cover rounded shrink-0"
                            />
                          ) : (
                            <img
                              src={fullUrl}
                              alt="reply-thumb"
                              className="w-9 h-9 object-cover rounded shrink-0"
                            />
                          );
                        })()
                      )}
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="p-1 hover:bg-muted rounded-full transition-colors shrink-0"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Chat Input */}
                {(() => {
                  const myMember = activeRoom?.members?.find(
                    (m: any) => m.id === user?.id,
                  );
                  const isAccepted =
                    myMember?.status === 'ACCEPTED' ||
                    myMember?.status === 'accepted' ||
                    myMember?.is_accepted === true ||
                    (myMember?.status === undefined &&
                      myMember?.is_accepted === undefined);

                  if (!isAccepted) {
                    const targetUser = activeRoom?.members?.find(
                      (m: any) => m.id !== user?.id,
                    );
                    return (
                      <div className="p-4 shrink-0 bg-background border-t border-border/10">
                        <div className="flex flex-col gap-4 text-center pb-4">
                          <p className="text-[15px] text-muted-foreground font-semibold px-4">
                            {getDisplayName(targetUser)} muốn gửi tin nhắn cho bạn. Họ
                            sẽ không biết bạn đã xem cho đến khi bạn chấp nhận.
                          </p>
                          <div className="flex justify-center gap-3">
                            <button
                              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
                              onClick={() => {
                                orvalClient({
                                  url: `/chat-rooms/${activeRoom.id}/accept-request`,
                                  method: 'POST',
                                })
                                  .then((response: any) => {
                                    const acceptedRoom =
                                      response?.data?.room || response?.room;
                                    if (acceptedRoom) {
                                      upsertChatRoomInCaches(
                                        queryClient,
                                        {
                                          ...acceptedRoom,
                                          is_request: false,
                                        },
                                        user?.id,
                                      );
                                    } else {
                                      patchChatRoomInCaches(
                                        queryClient,
                                        activeRoom.id,
                                        { is_request: false },
                                      );
                                      queryClient.invalidateQueries({
                                        queryKey:
                                          getChatRoomsControllerGetListChatRoomQueryKey(),
                                      });
                                    }
                                    setSelectedTab('primary');
                                    toast({ title: 'Đã chấp nhận tin nhắn' });
                                  })
                                  .catch(() => {
                                    queryClient.invalidateQueries({
                                      queryKey:
                                        getChatRoomsControllerGetListChatRoomQueryKey(),
                                    });
                                    toast({
                                      title: 'Lỗi khi chấp nhận',
                                      variant: 'destructive',
                                    });
                                  });
                              }}
                            >
                              Chấp nhận
                            </button>
                            <button
                              className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl font-bold transition-colors"
                              onClick={() => {
                                orvalClient({
                                  url: `/chat-rooms/${activeRoom.id}/decline-request`,
                                  method: 'POST',
                                })
                                  .then(() => {
                                    removeChatRoomFromCaches(
                                      queryClient,
                                      activeRoom.id,
                                    );
                                    navigate('/messages');
                                    toast({ title: 'Đã từ chối tin nhắn' });
                                  })
                                  .catch(() => {
                                    queryClient.invalidateQueries({
                                      queryKey:
                                        getChatRoomsControllerGetListChatRoomQueryKey(),
                                    });
                                    toast({
                                      title: 'Lỗi khi từ chối',
                                      variant: 'destructive',
                                    });
                                  });
                              }}
                            >
                              Từ chối
                            </button>
                            <button
                              className="px-6 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl font-bold transition-colors"
                              onClick={() => {
                                if (targetUser) {
                                  orvalClient({
                                    url: '/relations/update',
                                    method: 'POST',
                                    data: {
                                      user_id: targetUser.id,
                                      relation: 'block',
                                    },
                                  }).then(() => {
                                    removeChatRoomFromCaches(
                                      queryClient,
                                      activeRoom.id,
                                    );
                                    navigate('/messages');
                                    toast({ title: 'Đã chặn người dùng' });
                                  });
                                }
                              }}
                            >
                              Chặn
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (activeRoom?.type === 'direct' && activeRoom?.is_blocked) {
                    return (
                      <div className="p-4 shrink-0 bg-background border-t border-border/10">
                        <div className="p-3 bg-muted text-center rounded-xl border border-border/50">
                          <p className="text-[15px] text-muted-foreground font-semibold">
                            Bạn không thể trả lời cuộc trò chuyện này.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="p-4 shrink-0 bg-background border-t border-border/10">
                      <div className="flex items-center gap-2 border border-border/50 bg-background rounded-full px-2 py-1 relative">
                        {/* Emoji Trigger */}
                        <div className="relative">
                          <button
                            className={`p-2 hover:opacity-70 transition-colors ${showEmojiPicker ? 'text-[#0084ff]' : 'text-foreground'}`}
                            onClick={() => setShowEmojiPicker((prev) => !prev)}
                          >
                            <Smile className="w-6 h-6" />
                          </button>
                          {showEmojiPicker && (
                            <div className="absolute bottom-14 left-0 bg-background border border-border shadow-lg rounded-2xl p-2 flex gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                              {[
                                '❤️',
                                '😂',
                                '👍',
                                '🔥',
                                '😍',
                                '😢',
                                '🙌',
                                '👏',
                              ].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => {
                                    setMessageInput((prev) => prev + emoji);
                                    setShowEmojiPicker(false);
                                  }}
                                  className="hover:bg-muted p-2 rounded-lg text-lg transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <input
                          type="text"
                          placeholder="Nhắn tin..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleSendMessage()
                          }
                          ref={chatInputRef}
                          className="flex-1 bg-transparent outline-none text-[15px]"
                        />

                        {/* Hidden File Input */}
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        <div className="flex items-center text-foreground">
                          {messageInput.trim() || selectedFiles.length > 0 ? (
                            /* Show Send button when there is text or files */
                            <button
                              className="p-2 text-[#0084ff] hover:text-[#0084ff]/80 transition-colors"
                              onClick={handleSendMessage}
                            >
                              <Send className="w-6 h-6" />
                            </button>
                          ) : (
                            /* Show Image + Heart when input is empty */
                            <>
                              <button
                                className="p-2 hover:opacity-70"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <ImageIcon className="w-6 h-6" />
                              </button>
                              <button
                                className="p-2 hover:opacity-70 text-red-500 hover:text-red-600 transition-colors"
                                onClick={handleSendQuickEmoji}
                              >
                                <span className="text-2xl leading-none">
                                  {activeRoom?.quick_emoji || '👍'}
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 border-2 border-foreground rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-bold mb-2">Tin nhắn của bạn</h2>
                <p className="text-muted-foreground mb-6">
                  Gửi ảnh và tin nhắn riêng tư cho bạn bè hoặc nhóm.
                </p>
                <button className="px-4 py-1.5 bg-[#0084ff] text-white rounded-lg font-semibold text-sm hover:bg-[#0084ff]/90">
                  Gửi tin nhắn
                </button>
              </div>
            )}
          </div>

          {/* Chat Details Drawer */}
          {showInfo && selectedRoomId && activeRoom && (
            <div className="w-[320px] border-l border-border/40 shrink-0 bg-background flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
              <ChatDetailsDrawer
                roomId={selectedRoomId}
                activeRoom={activeRoom}
                currentUser={user}
                onClose={() => setShowInfo(false)}
              />
            </div>
          )}
        </div>

        {/* Media Preview Dialog */}
        <Dialog
          open={!!previewMedia}
          onOpenChange={(open) => !open && setPreviewMedia(null)}
        >
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/90 border-none flex items-center justify-center [&>button]:text-white">
            <DialogTitle className="sr-only">Xem trước phương tiện</DialogTitle>
            <DialogDescription className="sr-only">
              Phóng to hình ảnh hoặc video
            </DialogDescription>
            {previewMedia?.type === 'video' ? (
              <video
                src={previewMedia.url}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] object-contain"
              />
            ) : (
              <img
                src={previewMedia?.url}
                alt="Preview"
                className="max-w-full max-h-[90vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* ═══ Forward Dialog ═══ */}
      {forwardingMsg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-in fade-in duration-150">
          <div className="bg-background rounded-2xl shadow-2xl w-[420px] max-h-[500px] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-bold">Chuyển tiếp</h3>
              <button
                onClick={() => {
                  setForwardingMsg(null);
                  setForwardTargets([]);
                  setForwardSearch('');
                }}
                className="p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected targets chips + search */}
            <div className="px-4 py-2 flex items-center gap-2 flex-wrap border-b">
              <span className="text-sm font-medium text-muted-foreground">
                Tới:
              </span>
              {forwardTargets.map((roomId) => {
                const room = chatRooms.find((r: any) => r.id === roomId);
                const tgtUser = room?.members?.find(
                  (m: any) => m.id !== user?.id,
                );
                return (
                  <span
                    key={roomId}
                    className="inline-flex items-center gap-1 bg-[#0084ff]/10 text-[#0084ff] text-xs font-semibold px-2 py-1 rounded-full"
                  >
                    {getDisplayName(tgtUser)}
                    <button
                      onClick={() =>
                        setForwardTargets((prev) =>
                          prev.filter((id) => id !== roomId),
                        )
                      }
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm min-w-[80px]"
              />
            </div>

            {/* Room list */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {chatRooms
                .filter((room: any) => {
                  if (!forwardSearch) return true;
                  const tgtUser = room.members?.find(
                    (m: any) => m.id !== user?.id,
                  );
                  const keyword = forwardSearch.toLowerCase();
                  return (
                    (tgtUser?.username || '').toLowerCase().includes(keyword) ||
                    getDisplayName(tgtUser, '').toLowerCase().includes(keyword)
                  );
                })
                .map((room: any) => {
                  const tgtUser = room.members?.find(
                    (m: any) => m.id !== user?.id,
                  );
                  const isSelected = forwardTargets.includes(room.id);
                  return (
                    <div
                      key={room.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-muted' : 'hover:bg-muted/50'}`}
                      onClick={() => {
                        setForwardTargets((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== room.id)
                            : [...prev, room.id],
                        );
                      }}
                    >
                      <Avatar className="w-10 h-10">
                          <AvatarImage src={getUserAvatarUrl(tgtUser)} className="object-cover" />
                          <AvatarFallback className="bg-muted" />
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {getDisplayName(tgtUser)}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-[#0084ff] bg-[#0084ff]' : 'border-muted-foreground/30'}`}
                      >
                        {isSelected && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Send button */}
            <div className="px-4 py-3 border-t">
              <button
                disabled={forwardTargets.length === 0}
                className="w-full py-2.5 bg-[#0084ff] text-white font-semibold rounded-xl hover:bg-[#0084ff]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={async () => {
                  const socket = socketService.getSocket();
                  for (const targetRoomId of forwardTargets) {
                    try {
                      const tempId = 'forward-' + Date.now() + Math.random();
                      const hasMedia =
                        forwardingMsg.medias && forwardingMsg.medias.length > 0;

                      // Optimistic update
                      const tempMsg = {
                        id: tempId,
                        chat_room_id: targetRoomId,
                        created_by: user?.id,
                        message: forwardingMsg.message || '',
                        medias: forwardingMsg.medias || [],
                        created_at: new Date().toISOString(),
                        user: user,
                        is_sending: true,
                      };

                      queryClient.setQueryData(
                        getChatMessagesControllerGetMessageHistoryQueryKey(
                          targetRoomId,
                        ),
                        (old: any) => {
                          if (!old) return old;
                          return {
                            ...old,
                            data: {
                              ...old.data,
                              data: [...(old.data?.data || []), tempMsg],
                            },
                          };
                        },
                      );

                      if (socket?.connected) {
                        socket.emit('sendMessage', {
                          chat_room_id: targetRoomId,
                          message: forwardingMsg.message || '',
                          medias: hasMedia
                            ? JSON.stringify(forwardingMsg.medias)
                            : '',
                          tempId,
                        });
                      } else {
                        await createMessageMutation.mutateAsync({
                          data: {
                            chat_room_id: targetRoomId,
                            message: forwardingMsg.message || '',
                            medias: hasMedia
                              ? JSON.stringify(forwardingMsg.medias)
                              : '',
                          } as any,
                        });

                        // For REST, if we successfully mutate, we don't get 'messageSaved' so we should invalidate
                        queryClient.invalidateQueries({
                          queryKey:
                            getChatMessagesControllerGetMessageHistoryQueryKey(
                              targetRoomId,
                            ),
                        });
                      }

                      updateSidebarWithMessage(targetRoomId, {
                        message:
                          forwardingMsg.message || (hasMedia ? '📷 Ảnh' : ''),
                        created_by: user?.id,
                        created_at: new Date().toISOString(),
                      });
                    } catch (error) {
                      console.error('Forward failed:', error);
                    }
                  }
                  setForwardingMsg(null);
                  setForwardTargets([]);
                  setForwardSearch('');
                  toast({
                    title: 'Đã chuyển tiếp',
                    description: `Chuyển tiếp tới ${forwardTargets.length} cuộc trò chuyện`,
                  });
                }}
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Chat Block Warning Dialog */}
      <Dialog open={showGroupBlockWarning} onOpenChange={() => {}}>
        <DialogContent
          className="max-w-sm rounded-2xl bg-card border-none"
          hideCloseButton
        >
          <div className="flex flex-col items-center text-center px-4 py-2">
            <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <DialogTitle className="text-xl font-bold mb-2">
              Cảnh báo
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mb-6">
              Nhóm này có{' '}
              <strong>{getDisplayName(groupBlockedUser, 'một người dùng')}</strong>{' '}
              là người bạn đã chặn.
            </DialogDescription>
            <div className="flex flex-col w-full gap-2">
              <button
                className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition-colors"
                onClick={() => {
                  setDismissedGroupWarnings((prev) => {
                    const newSet = new Set(prev);
                    if (activeRoom?.id) newSet.add(activeRoom.id);
                    return newSet;
                  });
                  setShowGroupBlockWarning(false);
                }}
              >
                Ở lại
              </button>
              <button
                className="w-full py-2.5 bg-destructive text-destructive-foreground font-semibold rounded-xl hover:bg-destructive/90 transition-colors"
                onClick={async () => {
                  try {
                    await orvalClient({
                      url: `/chat-members/leave-room/${activeRoom?.id}`,
                      method: 'DELETE',
                    });
                    if (activeRoom?.id) {
                      removeChatRoomFromCaches(queryClient, activeRoom.id);
                    }
                    toast({
                      title: 'Đã rời nhóm',
                      description: 'Bạn đã rời khỏi nhóm này.',
                    });
                    navigate('/messages');
                    setShowGroupBlockWarning(false);
                  } catch (error) {
                    toast({
                      title: 'Lỗi',
                      description: 'Không thể rời nhóm',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                Rời nhóm
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateChatModal
        open={showCreateChatModal}
        onOpenChange={setShowCreateChatModal}
        onStartDirectChat={handleSelectUser}
      />
    </>
  );
}
