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
  Heart,
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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMessagingStore } from '../stores/messaging-store';
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
import { useNavigate } from 'react-router-dom';
import { MessagePostCard } from '../components/message-post-card';

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

  const { setActiveChats, selectedRoomId, setSelectedRoomId } =
    useMessagingStore();

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
  const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'video' | 'image' } | null>(null);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const [forwardTargets, setForwardTargets] = useState<string[]>([]);
  const [forwardSearch, setForwardSearch] = useState('');

  // Focus input when replying
  useEffect(() => {
    if (replyingTo && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [replyingTo]);

  // 1. Fetch Chat Rooms
  const { data: chatRoomsResponse, isLoading: isLoadingRooms } =
    useChatRoomsControllerGetListChatRoom();
  const chatRooms: any[] = (chatRoomsResponse as any)?.data?.data || [];

  // Populate Zustand store
  useEffect(() => {
    if (chatRooms.length) {
      setActiveChats(chatRooms);
    }
  }, [chatRooms, setActiveChats]);

  // 2. Fetch Message History (Query Cache as Source of Truth)
  const { data: messagesResponse, isFetching: isFetchingMessages } =
    useChatMessagesControllerGetMessageHistory(
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
  const hasMore: boolean = (messagesResponse as any)?.data?.meta?.has_more || false;

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
              data: currentList.map((m: any) =>
                m.id === data.tempId ? savedMsg : m,
              ),
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
                  ? { ...m, message: data.message, message_status: data.message_status }
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
                  ? { ...m, message: data.message, message_status: data.message_status, medias: [] }
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
    const handleUserStatusChanged = ({ user_id, is_online, last_active }: any) => {
      // Update room list cache
      queryClient.setQueriesData(
        { queryKey: getChatRoomsControllerGetListChatRoomQueryKey() },
        (old: any) => {
          if (!old || !old.data) return old;
          const data = old.data?.data || old.data;
          if (!Array.isArray(data)) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: data.map((room: any) => ({
                ...room,
                members: room.members.map((m: any) =>
                  m.id === user_id ? { ...m, is_online, last_active } : m,
                ),
              })),
            },
          };
        },
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
    const handleReactionUpdated = (data: { chat_room_id: string; message_id: string; reactions: any[] }) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.message_id ? { ...m, reactions: data.reactions } : m,
              ),
            },
          };
        },
      );
    };

    const handleMessagePinned = (data: { messageId: string, pinMessage: any, chat_room_id: string }) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.messageId ? { ...m, pin_messages: data.pinMessage } : m,
              ),
            },
          };
        },
      );
    };

    const handleMessageUnpinned = (data: { messageId: string, chat_room_id: string }) => {
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
    };
  }, [token, queryClient, toast]);

  // Scroll to bottom: instant on room change, smooth on new messages
  const prevMessagesLenRef = useRef(0);
  const hasScrolledForRoom = useRef<string | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    // Use rAF + timeout to ensure DOM has fully rendered
    requestAnimationFrame(() => {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
      }, 0);
      // Run again after a short delay in case images load and shift layout
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
      }, 300);
    });
  }, []);

  // Instant scroll when entering a room and messages finish loading
  useEffect(() => {
    if (
      selectedRoomId &&
      !isFetchingMessages &&
      messages.length > 0 &&
      hasScrolledForRoom.current !== selectedRoomId
    ) {
      scrollToBottom('instant');
      hasScrolledForRoom.current = selectedRoomId;
      prevMessagesLenRef.current = messages.length;
    }
  }, [selectedRoomId, isFetchingMessages, messages.length, scrollToBottom]);

  // Reset scroll flag and reply state when switching rooms
  useEffect(() => {
    hasScrolledForRoom.current = null;
    setReplyingTo(null);

    // Mark as read when room is selected
    if (selectedRoomId && user) {
      orvalClient({ url: `/chat-rooms/${selectedRoomId}/read`, method: 'POST' }).catch(console.error);
      
      // Optimistically clear unread count in sidebar
      queryClient.setQueryData(
        getChatRoomsControllerGetListChatRoomQueryKey({ page: 1, limit: 50 }),
        (old: any) => {
          if (!old?.data?.data) return old;
          const updatedRooms = old.data.data.map((r: any) => {
            if (r.id === selectedRoomId) {
              return { ...r, unread_count: 0 };
            }
            return r;
          });
          return { ...old, data: { ...old.data, data: updatedRooms } };
        }
      );
    }
  }, [selectedRoomId, user, queryClient]);

  // Smooth scroll when NEW messages arrive (not loading older ones)
  useEffect(() => {
    if (
      messages.length > prevMessagesLenRef.current &&
      !isLoadingMore &&
      hasScrolledForRoom.current === selectedRoomId
    ) {
      scrollToBottom('smooth');
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages.length, isLoadingMore, selectedRoomId, scrollToBottom]);

  /**
   * Optimistic sidebar update: move room to top + update last_message preview.
   * Avoids full API refetch — instant UI update.
   */
  const updateSidebarWithMessage = useCallback((roomId: string, msg: any) => {
    queryClient.setQueryData(
      getChatRoomsControllerGetListChatRoomQueryKey(),
      (old: any) => {
        if (!old?.data?.data) return old;
        const rooms = [...old.data.data];
        const idx = rooms.findIndex((r: any) => r.id === roomId);
        if (idx === -1) {
          // Room not in list — fallback to refetch
          queryClient.invalidateQueries({
            queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
          });
          return old;
        }
        // Update last_message and move to top
        const updatedRoom = {
          ...rooms[idx],
          last_message: msg,
          last_message_at: msg.created_at,
        };
        // If the message is for the currently selected room, mark as read immediately
        if (roomId === selectedRoomId) {
          updatedRoom.unread_count = 0;
          orvalClient({ url: `/chat-rooms/${roomId}/read`, method: 'POST' }).catch(console.error);
        }
        rooms.splice(idx, 1);
        rooms.unshift(updatedRoom);
        return { ...old, data: { ...old.data, data: rooms } };
      },
    );
  }, [queryClient]);

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

        try {
          const res = await chatMessagesControllerGetMessageHistory(
            selectedRoomId,
            { cursor: nextCursor }
          );
          const newMsgs = (res as any)?.data?.data || [];
          const meta = (res as any)?.data?.meta || {};

          if (newMsgs.length > 0) {
            queryClient.setQueryData(
              getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
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
                container.scrollTop = newScrollHeight - prevScrollHeight;
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
      { root: messagesContainerRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, selectedRoomId, handleLoadMore]);

  // Image & Video Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
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
    const handleSendMessage = async () => {
    if (!messageInput.trim() && selectedFiles.length === 0) return;
    if (!selectedRoomId && !virtualRecipient) return;

    const msg = messageInput.trim();
    const filesToSend = [...selectedFiles];
    const hasMedia = filesToSend.length > 0;
    const replyToId = replyingTo?.id;
    const currentReplyTo = replyingTo;

    setMessageInput('');
    setSelectedFiles([]);
    setReplyingTo(null);

    // If in virtual chat mode → create room first, then send
    if (!selectedRoomId && virtualRecipient) {
      try {
        const res = await getOrCreateRoomMutation.mutateAsync({
          targetUserId: virtualRecipient.id,
        });
        const newRoomId = (res as any)?.data?.room_id || (res as any)?.room_id;
        if (newRoomId) {
          setSelectedRoomId(newRoomId);
          setVirtualRecipient(null);
          // Refetch room list to include the new room
          await queryClient.invalidateQueries({
            queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
          });
          // Now send the message via WebSocket
          const socket = socketService.getSocket();
          if (socket?.connected) {
            socket.emit('sendMessage', {
              chat_room_id: newRoomId,
              message: msg,
              tempId: 'temp-' + Date.now(),
            });
          }
        }
      } catch (error: any) {
        console.error(error);
        toast({
          title: 'Không thể nhắn tin',
          description: 'Có lỗi xảy ra khi tạo phòng chat',
          variant: 'destructive',
        });
        setMessageInput(msg); // Restore input
      }
      return;
    }

    if (!selectedRoomId) return;

    const tempId = 'temp-' + Date.now();
    const tempMsg = {
      id: tempId,
      chat_room_id: selectedRoomId,
      created_by: user?.id,
      message: msg,
      medias: filesToSend.map((file) => URL.createObjectURL(file)),
      created_at: new Date().toISOString(),
      user: user,
      is_sending: true,
      reply_to: currentReplyTo || undefined,
    };

    // Step 1: Optimistically write temp message to query cache
    queryClient.setQueryData(
      getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
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
      createMessageMutation.mutate(
        {
          data: {
            chat_room_id: selectedRoomId,
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
              getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
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
            updateSidebarWithMessage(selectedRoomId, savedMsg);
          },
          onError: () => {
            // Mark temp message as failed
            queryClient.setQueryData(
              getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
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
            chat_room_id: selectedRoomId,
            message: msg,
            tempId,
            reply_to_id: replyToId,
          });
      } else {
        // Fallback to REST if socket is disconnected
        createMessageMutation.mutate(
          {
            data: {
              chat_room_id: selectedRoomId,
              message: msg,
              reply_to_id: replyToId,
            } as any,
          },
          {
            onSuccess: (res: any) => {
              const savedMsg = res?.data || res;
              queryClient.setQueryData(
                getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
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
                getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
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
  const handleToggleReaction = async (messageId: string, reactionType: string) => {
    if (!selectedRoomId) return;
    const queryKey = getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId);

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
            const userReactionIdx = existingReactions.findIndex((r: any) => r.user_id === user?.id);

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

  const handleSendHeart = () => {
    if (!selectedRoomId) return;

    const tempId = 'temp-' + Date.now();
    const tempMsg = {
      id: tempId,
      chat_room_id: selectedRoomId,
      created_by: user?.id,
      message: '❤️',
      created_at: new Date().toISOString(),
      user: user,
      is_sending: true,
    };

    // Optimistically write to query cache
    queryClient.setQueryData(
      getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
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

    createMessageMutation.mutate(
      {
        data: {
          chat_room_id: selectedRoomId,
          message: '❤️',
        },
      },
      {
        onSuccess: (res: any) => {
          const savedMsg = res?.data || res;
          queryClient.setQueryData(
            getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
            (old: any) => {
              if (!old) return old;
              const currentList = old.data?.data || [];
              return {
                ...old,
                data: {
                  ...old.data,
                  data: currentList.map((m: any) =>
                    m.id === tempId ? savedMsg : m
                  ),
                },
              };
            },
          );
        },
        onError: () => {
          queryClient.setQueryData(
            getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
            (old: any) => {
              if (!old) return old;
              const currentList = old.data?.data || [];
              return {
                ...old,
                data: {
                  ...old.data,
                  data: currentList.filter((m: any) => m.id !== tempId),
                },
              };
            },
          );
        },
      },
    );
  };

  // Selecting a Suggested/Search User — Virtual Room pattern
  const handleSelectUser = (targetUser: any) => {
    // Check if a room already exists with this user
    const existingRoom = chatRooms.find((room: any) =>
      room.members.some((m: any) => m.id === targetUser.id)
    );

    if (existingRoom) {
      // Room exists → just select it
      setSelectedRoomId(existingRoom.id);
      setVirtualRecipient(null);
    } else {
      // No room yet → enter virtual chat mode (no DB call)
      setSelectedRoomId(null as any);
      setVirtualRecipient(targetUser);
    }
    setSearchTerm('');
    setIsSearchFocused(false);
  };

  const activeRoom = chatRooms.find((r: any) => r.id === selectedRoomId);
  const otherUser =
    activeRoom?.members?.find((m: any) => m.id !== user?.id) ||
    virtualRecipient ||
    selectedRecipient;

  // Whether we're in virtual chat mode (no room created yet)
  const isVirtualChat = !selectedRoomId && !!virtualRecipient;

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

  // Helper check for video URLs
  const isVideo = (fileOrUrl: string | File) => {
    const url = typeof fileOrUrl === 'string' ? fileOrUrl : (fileOrUrl as any).type;
    return url.includes('video') || ['mp4', 'mov', 'webm', 'ogg', 'mkv', 'avi'].some(ext => url.toLowerCase().endsWith(ext));
  };

  return (
    <>
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Sidebar - Chat List */}
      <div className="w-[350px] flex flex-col border-r border-border/40 shrink-0">
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-6 shrink-0 pt-4">
          <div className="flex items-center gap-2 font-bold text-xl cursor-pointer">
            {user?.username} <span className="text-sm">⌄</span>
          </div>
          <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
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
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <span className="font-bold text-base">Tin nhắn</span>
          <button className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Tin nhắn đang chờ
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
                const isActive = room.id === selectedRoomId;

                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-muted/80' : 'hover:bg-muted/50'}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="w-14 h-14">
                        <AvatarImage
                          src={
                            targetUser?.profile_picture_url ||
                            targetUser?.avatar ||
                            'https://github.com/shadcn.png'
                          }
                        />
                        <AvatarFallback>
                          {targetUser?.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {targetUser?.is_online && (
                        <span className="absolute bottom-0.5 right-0.5 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">
                        {targetUser?.full_name || targetUser?.username}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {room.last_message
                          ? `${room.last_message.created_by === user?.id ? 'Bạn: ' : ''}${room.last_message.message} · ${formatRelativeTime(room.last_message_at)}`
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
                        <AvatarImage
                          src={u.avatar || 'https://github.com/shadcn.png'}
                        />
                        <AvatarFallback>
                          {u.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {u.is_online && (
                        <span className="absolute bottom-0.5 right-0.5 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">
                        {u.full_name || u.username}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        @{u.username}
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

      {/* Right Column - Chat View */}
      <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
        {(selectedRoomId && otherUser) || isVirtualChat ? (
          <>
            {/* Chat Header */}
            <div className="h-[75px] border-b border-border/40 flex items-center justify-between px-6 shrink-0">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)}
              >
                <div className="relative">
                  <Avatar className="w-11 h-11">
                    <AvatarImage
                      src={
                        otherUser.profile_picture_url ||
                        otherUser.avatar ||
                        'https://github.com/shadcn.png'
                      }
                    />
                    <AvatarFallback>
                      {otherUser.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {otherUser.is_online && (
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-base">
                    {otherUser.full_name || otherUser.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getStatusText(otherUser)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-foreground">
                <button className="hover:opacity-70">
                  <Info className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Pinned Messages Banner */}
            {(() => {
              const pinnedMessages = messages.filter((m: any) => m.pin_messages && (Array.isArray(m.pin_messages) ? m.pin_messages.length > 0 : true));
              if (pinnedMessages.length === 0) return null;
              
              if (pinnedMessages.length === 1 || !isPinnedExpanded) {
                const latestPinned = pinnedMessages[pinnedMessages.length - 1];
                const isMediaOnly = !latestPinned.message && latestPinned.medias && latestPinned.medias.length > 0;
                return (
                  <div className="bg-muted/30 border-b border-border/40 px-6 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
                    <div className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                         onClick={() => {
                           const el = document.getElementById(`msg-${latestPinned.id}`);
                           if (el) {
                             el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                             el.classList.add('bg-muted/50');
                             setTimeout(() => el.classList.remove('bg-muted/50'), 2000);
                           }
                         }}
                    >
                      <Pin className="w-3.5 h-3.5 rotate-45 text-amber-500 fill-amber-500 shrink-0" />
                      <span className="text-xs font-semibold truncate flex items-center gap-1">
                        {pinnedMessages.length} tin nhắn được ghim: 
                        {isMediaOnly ? (
                          <><ImageIcon className="w-3 h-3 text-muted-foreground"/> Hình ảnh/Video</>
                        ) : (
                          latestPinned.message
                        )}
                      </span>
                    </div>
                    {pinnedMessages.length > 1 && (
                      <button onClick={() => setIsPinnedExpanded(true)} className="p-1 hover:bg-muted rounded">
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
                     <button onClick={() => setIsPinnedExpanded(false)} className="p-1 hover:bg-muted rounded">
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                     </button>
                  </div>
                  <div className="px-6 pb-2 flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                    {pinnedMessages.map((m: any) => {
                      const isMediaOnly = !m.message && m.medias && m.medias.length > 0;
                      return (
                        <div key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                             onClick={() => {
                               const el = document.getElementById(`msg-${m.id}`);
                               if (el) {
                                 el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                 el.classList.add('bg-muted/50');
                                 setTimeout(() => el.classList.remove('bg-muted/50'), 2000);
                               }
                               setIsPinnedExpanded(false);
                             }}>
                           <div className="w-1 h-full bg-amber-500 rounded-full" />
                           <div className="text-xs truncate flex-1 flex items-center gap-1">
                              <span className="font-semibold text-muted-foreground mr-1 shrink-0">{m.user?.username || 'User'}:</span>
                              {isMediaOnly ? (
                                <><ImageIcon className="w-3 h-3 text-muted-foreground shrink-0"/> Hình ảnh/Video</>
                              ) : (
                                <span className="truncate">{m.message}</span>
                              )}
                           </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Chat Messages — no gap, grouping handled per-message */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col">
              {/* Infinite scroll sentinel — triggers auto-load when visible */}
              <div ref={loadMoreSentinelRef} className="h-1 shrink-0" />
              {isLoadingMore && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Avatar introduction */}
              {!hasMore && (
                <div className="flex flex-col items-center justify-center pt-8 pb-12 gap-3">
                  <Avatar className="w-24 h-24">
                    <AvatarImage
                      src={
                        otherUser.profile_picture_url ||
                        otherUser.avatar ||
                        'https://github.com/shadcn.png'
                      }
                    />
                    <AvatarFallback>
                      {otherUser.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold">
                    {otherUser.full_name || otherUser.username}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {otherUser.username}
                  </p>
                  <button
                    className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg font-semibold text-sm hover:bg-secondary/80 transition-colors"
                    onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)}
                  >
                    Xem trang cá nhân
                  </button>
                </div>
              )}

              {/* Messages Mapping — Instagram/Messenger-style connected bubbles */}
              {messages.map((msg: any, idx: number) => {
                const isMine = msg.created_by === user?.id;
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
                const isSameSenderAsPrev = prevMsg && prevMsg.created_by === msg.created_by;
                const isSameSenderAsNext = nextMsg && nextMsg.created_by === msg.created_by;
                const showAvatar = !isMine && !isSameSenderAsNext;

                // Time separator: show if >5 min gap from previous message
                const showTimeSeparator = (() => {
                  if (!prevMsg) return false;
                  const prev = new Date(prevMsg.created_at).getTime();
                  const curr = new Date(msg.created_at).getTime();
                  return curr - prev > 5 * 60 * 1000; // 5 minutes
                })();

                // Emoji-only detection: message with only emoji/whitespace, no media
                const isEmojiOnly = (() => {
                  if (!msg.message || (msg.medias && msg.medias.length > 0)) return false;
                  const emojiRegex = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]+$/u;
                  return emojiRegex.test(msg.message) && msg.message.trim().length <= 8;
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

                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className="transition-colors duration-500 rounded-xl px-1 -mx-1">
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
                        marginBottom: msg.reactions && msg.reactions.length > 0 ? '10px' : '0px',
                      }}
                    >
                      {/* Avatar: show on last message of group, spacer otherwise */}
                      {!isMine && (
                        showAvatar ? (
                          <Avatar className="w-7 h-7 shrink-0">
                            <AvatarImage
                              src={
                                msg.user?.profile_picture_url ||
                                msg.user?.avatar ||
                                otherUser.profile_picture_url ||
                                otherUser.avatar ||
                                'https://github.com/shadcn.png'
                              }
                            />
                            <AvatarFallback>
                              {msg.user?.username?.[0]?.toUpperCase() || otherUser.username?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-7 shrink-0" />
                        )
                      )}

                      {/* Context menu + quick actions for own messages */}
                      {isMine && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                          {/* Quick reaction picker */}
                          <div className="flex items-center bg-background border border-border/50 rounded-full px-1 py-0.5 shadow-sm mr-0.5">
                            {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                              <button
                                key={type}
                                className="text-xs hover:scale-125 transition-transform p-0.5"
                                title={type}
                                onClick={() => handleToggleReaction(msg.id, type)}
                              >
                                {emoji}
                              </button>
                            ))}
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
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </div>
                              <DropdownMenuItem
                                className="cursor-pointer flex justify-between py-2 rounded-lg"
                                onClick={() => setForwardingMsg(msg)}
                              >
                                Chuyển tiếp <Forward className="w-4 h-4 ml-2" />
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
                                        const action = res?.data?.action || res?.action;
                                        const pinMessage = res?.data?.pinMessage || res?.pinMessage;
                                        queryClient.setQueryData(
                                          getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId!),
                                          (old: any) => {
                                            if (!old) return old;
                                            return {
                                              ...old,
                                              data: {
                                                ...old.data,
                                                data: (old.data?.data || []).map((m: any) =>
                                                  m.id === msg.id ? { ...m, pin_messages: action === 'pinned' ? pinMessage : null } : m,
                                                ),
                                              },
                                            };
                                          },
                                        );
                                      },
                                      onError: (error: any) => {
                                        if (error?.response?.status === 400) {
                                          toast({
                                            title: 'Không thể ghim',
                                            description: error.response?.data?.message || 'Bạn chỉ có thể ghim tối đa 3 tin nhắn',
                                            variant: 'destructive',
                                          });
                                        }
                                      }
                                    }
                                  )
                                }
                              >
                                {msg.pin_messages && (Array.isArray(msg.pin_messages) ? msg.pin_messages.length > 0 : true) ? 'Bỏ Ghim' : 'Ghim'} <Pin className="w-4 h-4 ml-2" />
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer flex justify-between py-2 text-destructive focus:text-destructive rounded-lg"
                                onClick={() => {
                                  queryClient.setQueryData(
                                    getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId!),
                                    (old: any) => {
                                      if (!old) return old;
                                      return {
                                        ...old,
                                        data: {
                                          ...old.data,
                                          data: (old.data?.data || []).filter((m: any) => m.id !== msg.id),
                                        },
                                      };
                                    },
                                  );
                                  deleteMutation.mutate({ id: msg.id });
                                }}
                              >
                                Thu hồi <Trash2 className="w-4 h-4 ml-2" />
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}

                      {/* Message content */}
                      <div
                        onDoubleClick={handleSendHeart}
                        className="relative flex flex-col max-w-[60%] select-none cursor-pointer"
                      >
                        {/* Pinned badge */}
                        {msg.pin_messages && (Array.isArray(msg.pin_messages) ? msg.pin_messages.length > 0 : true) && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground self-start pl-1 mb-0.5">
                            <Pin className="w-3 h-3 rotate-45 text-amber-500 fill-amber-500" />{' '}
                            Đã ghim
                          </div>
                        )}

                        {/* Quoted reply preview */}
                        {msg.reply_to && (
                          <>
                            {/* Reply Header */}
                            <span className={`text-[11px] text-muted-foreground/80 mb-0.5 ${isMine ? 'self-end text-right' : 'self-start text-left'}`}>
                              {isMine ? (
                                `Bạn đã trả lời ${msg.reply_to.user?.full_name || msg.reply_to.user?.username || 'người dùng'}`
                              ) : (
                                `${msg.user?.full_name || msg.user?.username || 'người dùng'} đã trả lời ${
                                  msg.reply_to.created_by === user?.id
                                    ? 'bạn'
                                    : (msg.reply_to.user?.full_name || msg.reply_to.user?.username || 'người dùng')
                                }`
                              )}
                            </span>
                            {/* Quoted Bubble */}
                            <div
                              onClick={() => {
                                const el = document.getElementById(`msg-${msg.reply_to.id}`);
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  el.classList.add('bg-muted/50', 'transition-colors', 'duration-500');
                                  setTimeout(() => {
                                    el.classList.remove('bg-muted/50');
                                  }, 2000);
                                }
                              }}
                              className={`px-3 py-1.5 bg-muted/60 dark:bg-muted/40 text-muted-foreground text-xs rounded-xl mb-1 max-w-[85%] cursor-pointer hover:bg-muted/80 transition-colors flex items-center gap-2 ${
                                isMine ? 'self-end' : 'self-start'
                              }`}
                            >
                              {msg.reply_to.message_status === 'deleted' ? (
                                <span className="truncate">Tin nhắn đã thu hồi</span>
                              ) : msg.reply_to.shared_post_id ? (
                                <>
                                  <ImageIcon className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Bài viết của {msg.reply_to.shared_post?.user?.username || 'người dùng'}</span>
                                  {msg.reply_to.shared_post?.medias?.[0] && (
                                    <img 
                                      src={msg.reply_to.shared_post.medias[0].startsWith('http') || msg.reply_to.shared_post.medias[0].startsWith('blob:') ? msg.reply_to.shared_post.medias[0] : `${import.meta.env.VITE_MEDIA_URL}/${msg.reply_to.shared_post.medias[0]}`} 
                                      alt="thumbnail" 
                                      className="w-6 h-6 object-cover rounded shrink-0"
                                    />
                                  )}
                                </>
                              ) : msg.reply_to.medias && msg.reply_to.medias.length > 0 && !msg.reply_to.message ? (
                                <>
                                  <ImageIcon className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Hình ảnh/Video</span>
                                  <img 
                                    src={msg.reply_to.medias[0].startsWith('http') || msg.reply_to.medias[0].startsWith('blob:') ? msg.reply_to.medias[0] : `${import.meta.env.VITE_MEDIA_URL}/${msg.reply_to.medias[0]}`} 
                                    alt="thumbnail" 
                                    className="w-6 h-6 object-cover rounded shrink-0"
                                  />
                                </>
                              ) : (
                                <span className="truncate line-clamp-2">{msg.reply_to.message}</span>
                              )}
                            </div>
                          </>
                        )}

                        {/* Shared Post Card */}
                        {msg.shared_post_id && (
                          <div className={`mt-1 mb-1 ${msg.is_sending ? 'opacity-70' : ''}`}>
                            <MessagePostCard post={msg.shared_post} />
                          </div>
                        )}

                        {/* Media attachments */}
                        {msg.medias && msg.medias.length > 0 && (
                          <div
                            className={`grid gap-1 overflow-hidden ${
                              msg.medias.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                            } ${msg.is_sending ? 'opacity-70' : ''}`}
                            style={{ borderRadius: bubbleRadius }}
                          >
                            {msg.medias.map((url: string, mediaIdx: number) => {
                              const fullUrl = url.startsWith('http') || url.startsWith('blob:')
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
                                  className="max-h-60 w-full object-cover hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewMedia({ url: fullUrl, type: isVideoMedia ? 'video' : 'image' })}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Text bubble with connected border-radius */}
                        {msg.message && (
                          isEmojiOnly ? (
                            /* Large emoji without bubble */
                            <div className={`text-4xl py-1 ${msg.is_sending ? 'opacity-70' : ''}`}>
                              {msg.message}
                            </div>
                          ) : (
                            <div
                              className={`px-3 py-2 text-[15px] leading-[20px] relative ${
                                isMine
                                  ? 'bg-[#0084ff] text-white'
                                  : 'bg-muted text-foreground'
                              } ${msg.is_sending ? 'opacity-70' : ''} ${
                                msg.is_failed ? 'bg-red-500 text-white' : ''
                              }`}
                              style={{ borderRadius: bubbleRadius }}
                            >
                              {msg.message}
                              {msg.is_sending && (
                                <span className="absolute bottom-0.5 right-2 text-[8px] opacity-60">
                                  đang gửi...
                                </span>
                              )}
                              {msg.is_failed && (
                                <span className="absolute bottom-0.5 right-2 text-[8px] text-white font-bold">
                                  lỗi
                                </span>
                              )}
                            </div>
                          )
                        )}

                        {/* Reaction badges (optimistic overlay) */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={`absolute -bottom-2.5 z-10 ${isMine ? 'right-2' : 'left-2'}`}>
                            <div className="inline-flex items-center gap-0.5 bg-background border border-border/50 rounded-full px-1.5 py-0.5 shadow-sm text-xs cursor-pointer hover:scale-110 transition-transform">
                              {Object.entries(
                                msg.reactions.reduce((acc: Record<string, number>, r: any) => {
                                  acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
                                  return acc;
                                }, {})
                              ).map(([type, count]) => (
                                <span key={type} title={type}>
                                  {REACTION_EMOJIS[type] || type}{(count as number) > 1 ? ` ${count}` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>



                    {!isMine && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        {/* Quick reaction picker */}
                        <div className="flex items-center bg-background border border-border/50 rounded-full px-1 py-0.5 shadow-sm mr-0.5">
                          {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                            <button
                              key={type}
                              className="text-xs hover:scale-125 transition-transform p-0.5"
                              title={type}
                              onClick={() => handleToggleReaction(msg.id, type)}
                            >
                              {emoji}
                            </button>
                          ))}
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
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </div>
                          <DropdownMenuItem
                            className="cursor-pointer flex justify-between py-2 rounded-lg"
                            onClick={() => setForwardingMsg(msg)}
                          >
                            Chuyển tiếp <Forward className="w-4 h-4 ml-2" />
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
                                    const action = res?.data?.action || res?.action;
                                    const pinMessage = res?.data?.pinMessage || res?.pinMessage;
                                    queryClient.setQueryData(
                                      getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId!),
                                      (old: any) => {
                                        if (!old) return old;
                                        return {
                                          ...old,
                                          data: {
                                            ...old.data,
                                            data: (old.data?.data || []).map((m: any) =>
                                              m.id === msg.id ? { ...m, pin_messages: action === 'pinned' ? pinMessage : null } : m,
                                            ),
                                          },
                                        };
                                      },
                                    );
                                  },
                                  onError: (error: any) => {
                                    if (error?.response?.status === 400) {
                                      toast({
                                        title: 'Không thể ghim',
                                        description: error.response?.data?.message || 'Bạn chỉ có thể ghim tối đa 3 tin nhắn',
                                        variant: 'destructive',
                                      });
                                    }
                                  }
                                }
                              )
                            }
                          >
                            {msg.pin_messages && (Array.isArray(msg.pin_messages) ? msg.pin_messages.length > 0 : true) ? 'Bỏ Ghim' : 'Ghim'} <Pin className="w-4 h-4 ml-2" />
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
              })}
              <div ref={messagesEndRef} />
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
                      Đang trả lời {replyingTo.user?.full_name || replyingTo.user?.username || 'người dùng'}
                    </p>
                    {replyingTo.shared_post_id ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                         <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                         <span className="text-xs text-muted-foreground truncate">Bài viết của {replyingTo.shared_post?.user?.username || 'người dùng'}</span>
                      </div>
                    ) : replyingTo.medias && replyingTo.medias.length > 0 && !replyingTo.message ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                         <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                         <span className="text-xs text-muted-foreground truncate">Hình ảnh/Video</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate">
                        {replyingTo.message}
                      </p>
                    )}
                  </div>
                  {replyingTo.shared_post_id && replyingTo.shared_post?.medias?.[0] ? (
                    <img 
                      src={replyingTo.shared_post.medias[0].startsWith('http') || replyingTo.shared_post.medias[0].startsWith('blob:') ? replyingTo.shared_post.medias[0] : `${import.meta.env.VITE_MEDIA_URL}/${replyingTo.shared_post.medias[0]}`} 
                      className="w-9 h-9 object-cover rounded shrink-0" 
                      alt="reply-thumb"
                    />
                  ) : replyingTo.medias && replyingTo.medias.length > 0 && (
                    <img 
                      src={replyingTo.medias[0].startsWith('http') || replyingTo.medias[0].startsWith('blob:') ? replyingTo.medias[0] : `${import.meta.env.VITE_MEDIA_URL}/${replyingTo.medias[0]}`} 
                      className="w-9 h-9 object-cover rounded shrink-0" 
                      alt="reply-thumb"
                    />
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
                      {['❤️', '😂', '👍', '🔥', '😍', '😢', '🙌', '👏'].map(
                        (emoji) => (
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
                        ),
                      )}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Nhắn tin..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
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
                        onClick={handleSendHeart}
                      >
                        <Heart className="w-6 h-6 fill-current" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
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

      {/* Media Preview Dialog */}
      <Dialog open={!!previewMedia} onOpenChange={(open) => !open && setPreviewMedia(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/90 border-none flex items-center justify-center [&>button]:text-white">
          <DialogTitle className="sr-only">Xem trước phương tiện</DialogTitle>
          <DialogDescription className="sr-only">Phóng to hình ảnh hoặc video</DialogDescription>
          {previewMedia?.type === 'video' ? (
            <video src={previewMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain" />
          ) : (
            <img src={previewMedia?.url} alt="Preview" className="max-w-full max-h-[90vh] object-contain" />
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
              onClick={() => { setForwardingMsg(null); setForwardTargets([]); setForwardSearch(''); }}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selected targets chips + search */}
          <div className="px-4 py-2 flex items-center gap-2 flex-wrap border-b">
            <span className="text-sm font-medium text-muted-foreground">Tới:</span>
            {forwardTargets.map((roomId) => {
              const room = chatRooms.find((r: any) => r.id === roomId);
              const tgtUser = room?.members?.find((m: any) => m.id !== user?.id);
              return (
                <span key={roomId} className="inline-flex items-center gap-1 bg-[#0084ff]/10 text-[#0084ff] text-xs font-semibold px-2 py-1 rounded-full">
                  {tgtUser?.full_name || tgtUser?.username}
                  <button onClick={() => setForwardTargets((prev) => prev.filter((id) => id !== roomId))}>
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
                const tgtUser = room.members?.find((m: any) => m.id !== user?.id);
                const name = (tgtUser?.full_name || tgtUser?.username || '').toLowerCase();
                return name.includes(forwardSearch.toLowerCase());
              })
              .map((room: any) => {
                const tgtUser = room.members?.find((m: any) => m.id !== user?.id);
                const isSelected = forwardTargets.includes(room.id);
                return (
                  <div
                    key={room.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-muted' : 'hover:bg-muted/50'}`}
                    onClick={() => {
                      setForwardTargets((prev) =>
                        isSelected ? prev.filter((id) => id !== room.id) : [...prev, room.id]
                      );
                    }}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={tgtUser?.profile_picture_url || tgtUser?.avatar || 'https://github.com/shadcn.png'} />
                      <AvatarFallback>{tgtUser?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{tgtUser?.full_name || tgtUser?.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{tgtUser?.username}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-[#0084ff] bg-[#0084ff]' : 'border-muted-foreground/30'}`}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
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
                for (const targetRoomId of forwardTargets) {
                  try {
                    await createMessageMutation.mutateAsync({
                      data: {
                        chat_room_id: targetRoomId,
                        message: forwardingMsg.message || '',
                      },
                    });
                    updateSidebarWithMessage(targetRoomId, {
                      message: forwardingMsg.message || '📷 Ảnh',
                      created_by: user?.id,
                      created_at: new Date().toISOString(),
                    });
                    queryClient.invalidateQueries({
                      queryKey: getChatMessagesControllerGetMessageHistoryQueryKey(targetRoomId),
                    });
                  } catch (error) {
                    console.error('Forward failed:', error);
                  }
                }
                setForwardingMsg(null);
                setForwardTargets([]);
                setForwardSearch('');
                toast({ title: 'Đã chuyển tiếp', description: `Chuyển tiếp tới ${forwardTargets.length} cuộc trò chuyện` });
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
