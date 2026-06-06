import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Info, 
  Bell, 
  BellOff, 
  Users, 
  Smile, 
  ShieldAlert, 
  Ban, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useChatRoomsControllerUpdateSettings,
  useChatRoomsControllerUpdateEmoji,
  useChatRoomsControllerSoftDeleteHistory,
  useRelationsControllerUpdateRelation,
  getChatRoomsControllerGetListChatRoomQueryKey,
  getChatMessagesControllerGetMessageHistoryQueryKey,
} from '@/services/apis/gen/queries';

interface ChatDetailsDrawerProps {
  roomId: string;
  activeRoom: any;
  currentUser: any;
  onClose?: () => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🔥', '😍', '😢', '🙌', '👏', '🎉', '🌟'];

export default function ChatDetailsDrawer({ roomId, activeRoom, currentUser, onClose }: ChatDetailsDrawerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  // Mutations
  const updateSettingsMutation = useChatRoomsControllerUpdateSettings();
  const updateEmojiMutation = useChatRoomsControllerUpdateEmoji();
  const deleteHistoryMutation = useChatRoomsControllerSoftDeleteHistory();
  const updateRelationMutation = useRelationsControllerUpdateRelation();

  if (!activeRoom) return null;

  // Lấy ra thông tin đối phương (nếu là chat 1-1)
  const otherMember = activeRoom.members?.find((m: any) => m.id !== currentUser?.id);
  const isDirect = activeRoom.type === 'direct';

  // Trạng thái mute hiện tại của bản thân
  const isMuted = activeRoom.is_muted || false;
  const currentEmoji = activeRoom.quick_emoji || '👍';

  // 1. Mute toggle handler
  const handleToggleMute = (checked: boolean) => {
    // Optimistic update trong cache room list
    const roomListKey = getChatRoomsControllerGetListChatRoomQueryKey();
    const previousRooms = queryClient.getQueryData(roomListKey);

    queryClient.setQueryData(roomListKey, (old: any) => {
      if (!old?.data?.data) return old;
      return {
        ...old,
        data: {
          ...old.data,
          data: old.data.data.map((r: any) => 
            r.id === roomId ? { ...r, is_muted: checked } : r
          )
        }
      };
    });

    updateSettingsMutation.mutate(
      {
        id: roomId,
        data: { is_muted: checked }
      },
      {
        onSuccess: () => {
          toast({
            title: checked ? 'Đã tắt thông báo' : 'Đã bật thông báo',
            description: `Bạn sẽ ${checked ? 'không nhận' : 'nhận'} thông báo đẩy từ cuộc trò chuyện này.`,
          });
        },
        onError: (err) => {
          // Revert cache
          queryClient.setQueryData(roomListKey, previousRooms);
          toast({
            title: 'Lỗi',
            description: 'Không thể cập nhật cài đặt thông báo',
            variant: 'destructive',
          });
        }
      }
    );
  };

  // 2. Change Emoji handler
  const handleChangeEmoji = (emoji: string) => {
    // Optimistic update
    const roomListKey = getChatRoomsControllerGetListChatRoomQueryKey({ page: 1, limit: 50 });
    const previousRooms = queryClient.getQueryData(roomListKey);

    queryClient.setQueryData(roomListKey, (old: any) => {
      if (!old?.data?.data) return old;
      return {
        ...old,
        data: {
          ...old.data,
          data: old.data.data.map((r: any) => 
            r.id === roomId ? { ...r, quick_emoji: emoji } : r
          )
        }
      };
    });

    updateEmojiMutation.mutate(
      {
        id: roomId,
        data: { emoji }
      },
      {
        onSuccess: () => {
          toast({
            title: 'Đã đổi biểu tượng cảm xúc',
            description: `Biểu tượng cảm xúc nhanh đã được đổi thành ${emoji}`,
          });
        },
        onError: () => {
          queryClient.setQueryData(roomListKey, previousRooms);
          toast({
            title: 'Lỗi',
            description: 'Không thể đổi biểu tượng cảm xúc',
            variant: 'destructive',
          });
        }
      }
    );
  };

  // 3. Delete Chat history handler — follows Rules 1, 2, 3
  const handleDeleteChat = () => {
    deleteHistoryMutation.mutate(
      { id: roomId },
      {
        onSuccess: () => {
          const clearedAt = new Date().toISOString();

          // ── Rule 1: Filter messages using cleared_at, never splice/pop/assign[] ──
          queryClient.setQueryData(
            getChatMessagesControllerGetMessageHistoryQueryKey(roomId),
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                data: {
                  ...old.data,
                  // Keep only messages created AFTER cleared_at (none for now = empty view)
                  data: (old.data?.data || []).filter(
                    (m: any) => new Date(m.created_at) > new Date(clearedAt)
                  ),
                },
              };
            },
          );

          // ── Rule 3: Update badge count by removing this room from sidebar cache ──
          queryClient.setQueryData(
            getChatRoomsControllerGetListChatRoomQueryKey({ page: 1, limit: 50 }),
            (old: any) => {
              if (!old?.data?.data) return old;
              return {
                ...old,
                data: {
                  ...old.data,
                  data: (old.data.data as any[]).filter(
                    (r: any) => r.id !== roomId
                  ),
                },
              };
            },
          );

          // ── Rule 2: Realtime safety — new messages from WebSocket will
          //    be appended by the global handleNewMessage listener, which also
          //    calls invalidateQueries on the room list, so the room will
          //    re-appear in the sidebar automatically. ──

          toast({
            title: 'Đã xóa cuộc trò chuyện',
            description: 'Lịch sử cuộc trò chuyện đã bị xóa phía bạn.',
          });

          // Navigate away from deleted room
          navigate('/messages');
          if (onClose) onClose();
        },
        onError: () => {
          toast({
            title: 'Lỗi',
            description: 'Không thể xóa cuộc trò chuyện',
            variant: 'destructive',
          });
        }
      }
    );
  };

  // 4. Block / Restrict handlers
  const handleRelationAction = (type: 'block' | 'restrict') => {
    if (!otherMember) return;

    const payload: any = { user_id: otherMember.id };
    if (type === 'block') {
      payload.relation = 'block';
    } else {
      payload.action = 'restrict';
    }

    updateRelationMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({
            title: type === 'block' ? 'Đã chặn người dùng' : 'Đã hạn chế người dùng',
            description: type === 'block' 
              ? 'Người này sẽ không thể nhắn tin hoặc xem profile của bạn.'
              : 'Tin nhắn của họ sẽ được chuyển vào mục spam/chờ.',
          });
          
          // Sau khi chặn/hạn chế thì văng ra ngoài phòng chat
          navigate('/messages');
          if (onClose) onClose();
        },
        onError: () => {
          toast({
            title: 'Lỗi',
            description: 'Không thể thực hiện tác vụ',
            variant: 'destructive',
          });
        }
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      {/* Header Info Drawer */}
      <div className="p-6 flex flex-col items-center border-b border-border/50 gap-3">
        <Avatar className="w-20 h-20 shadow-md">
          <AvatarImage 
            src={isDirect 
              ? (otherMember?.avatar || '/default-avatar.png') 
              : activeRoom.avatar
            } 
          />
          <AvatarFallback>{isDirect ? otherMember?.username?.[0]?.toUpperCase() : activeRoom.name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h3 className="font-bold text-lg leading-tight truncate max-w-[240px]">
            {isDirect ? (otherMember?.full_name || otherMember?.username) : activeRoom.name}
          </h3>
          {isDirect && (
            <p className="text-xs text-muted-foreground mt-0.5">@{otherMember?.username}</p>
          )}
        </div>
      </div>

      {/* Action Options List */}
      <div className="flex-1 p-4 space-y-6">
        
        {/* Section 1: Settings */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Cấu hình phòng</h4>
          
          {/* Mute toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              {isMuted ? (
                <BellOff className="w-5 h-5 text-amber-500" />
              ) : (
                <Bell className="w-5 h-5 text-muted-foreground" />
              )}
              <div className="text-sm font-medium">Tắt thông báo</div>
            </div>
            <Switch 
              checked={isMuted}
              onCheckedChange={handleToggleMute}
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          {/* Quick emoji selection */}
          <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <Smile className="w-5 h-5 text-muted-foreground" />
              <div className="text-sm font-medium">Biểu tượng cảm xúc nhanh</div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-xl p-1.5 hover:bg-muted rounded-lg transition-transform hover:scale-110">
                  {currentEmoji}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[180px] p-2" align="end">
                <div className="grid grid-cols-5 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleChangeEmoji(emoji)}
                      className="text-lg hover:bg-muted p-1 rounded-md transition-colors text-center"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Section 2: Members Accordion */}
        <div className="space-y-2">
          <button 
            onClick={() => setIsMembersOpen(!isMembersOpen)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Thành viên ({activeRoom.members?.length || 0})</span>
            </div>
            {isMembersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {isMembersOpen && (
            <div className="pl-4 space-y-2.5 max-h-[220px] overflow-y-auto pt-1">
              {activeRoom.members?.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between pr-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={member.avatar || '/default-avatar.png'} />
                      <AvatarFallback>{member.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate max-w-[130px]">{member.full_name || member.username}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {member.member_type || 'Thành viên'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(`/profile/${member.id}`)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                    title="Xem trang cá nhân"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Safety & Actions */}
        <div className="space-y-3 pt-4 border-t border-border/50">
          
          {/* Restrict button (Only for Direct Chats) */}
          {isDirect && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-xl"
                >
                  <ShieldAlert className="w-5 h-5" />
                  <span>Hạn chế người dùng</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hạn chế người dùng này?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tin nhắn của người này sẽ được chuyển sang mục "Tin nhắn chờ", đồng thời họ sẽ không thấy khi bạn online hoặc đã đọc tin nhắn của họ.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => handleRelationAction('restrict')}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    Hạn chế
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Block button (Only for Direct Chats) */}
          {isDirect && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl"
                >
                  <Ban className="w-5 h-5" />
                  <span>Chặn tài khoản</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Chặn người dùng này?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Họ sẽ không thể gửi tin nhắn, theo dõi hoặc xem bài viết của bạn. Hành động này không thể hoàn tác dễ dàng.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => handleRelationAction('block')}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    Chặn
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Delete chat history button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl"
                disabled={deleteHistoryMutation.isPending}
              >
                <Trash2 className="w-5 h-5" />
                <span>Xóa lịch sử chat</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa cuộc trò chuyện này?</AlertDialogTitle>
                <AlertDialogDescription>
                  Thao tác này sẽ xóa bản sao của cuộc trò chuyện khỏi hộp thư của bạn. Bạn không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteChat}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Xóa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>

      </div>
    </div>
  );
}
