import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Users,
  Smile,
  ShieldAlert,
  Ban,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Unlock,
  MoreHorizontal,
  Camera,
  Crown,
  Pencil,
  UserPlus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  useChatRoomsControllerUpdateNameOrAvatar,
  useChatRoomsControllerUpdateEmoji,
  useChatRoomsControllerSoftDeleteHistory,
  useRelationsControllerUpdateRelation,
  getChatMessagesControllerGetMessageHistoryQueryKey,
  getChatRoomsControllerGetListChatRoomQueryKey,
  useChatMembersControllerLeaveRoom,
  useRelationsControllerGetRelation,
  useChatRoomsControllerUpdatePermissionAddMember,
} from '@/services/apis/gen/queries';
import { useBlockUser } from '@/features/profile/hooks/use-block-user';
import { useChatMembersControllerRemoveMember } from '@/services/apis/gen/queries';
import { AddMembersModal } from './AddMembersModal';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import {
  patchChatRoomInCaches,
  removeChatRoomFromCaches,
  upsertChatRoomInCaches,
} from '../utils/chat-room-cache';
import {
  getDisplayName,
  getGroupAvatarUrl,
  getUserAvatarUrl,
} from '@/utils/user';

interface ChatDetailsDrawerProps {
  roomId: string;
  activeRoom: any;
  currentUser: any;
  onClose?: () => void;
}

const COMMON_EMOJIS = [
  '👍',
  '❤️',
  '😂',
  '🔥',
  '😍',
  '😢',
  '🙌',
  '👏',
  '🎉',
  '🌟',
];

export default function ChatDetailsDrawer({
  roomId,
  activeRoom,
  currentUser,
  onClose,
}: ChatDetailsDrawerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  // Mutations
  const updateSettingsMutation = useChatRoomsControllerUpdateSettings();
  const updateRoomMutation = useChatRoomsControllerUpdateNameOrAvatar();
  const updateEmojiMutation = useChatRoomsControllerUpdateEmoji();
  const deleteHistoryMutation = useChatRoomsControllerSoftDeleteHistory();
  const leaveRoomMutation = useChatMembersControllerLeaveRoom();
  const updateRelationMutation = useRelationsControllerUpdateRelation();
  const removeMemberMutation = useChatMembersControllerRemoveMember();
  const updatePermissionMutation =
    useChatRoomsControllerUpdatePermissionAddMember();
  const promoteAdminMutation = useMutation({
    mutationFn: async (targetId: string) => {
      const res = await AXIOS_INSTANCE.patch('/chat-members/promote-admin', {
        chat_room_id: roomId,
        target_user_id: targetId,
      });
      return res.data;
    },
  });
  const { blockMutation, unblockMutation } = useBlockUser();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const muteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const muteRequestSeqRef = useRef(0);
  const lastCommittedMuteRef = useRef(false);
  const pendingMuteRef = useRef<boolean | null>(null);
  const [localIsMuted, setLocalIsMuted] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const isDirect = activeRoom?.type === 'direct';
  const currentUserRole = activeRoom?.members?.find(
    (m: any) => m.id === currentUser?.id,
  )?.member_type;
  const isCurrentUserAdmin =
    !isDirect && (currentUserRole === 'ADMIN' || currentUserRole === 'admin');

  // Quyền thêm thành viên của nhóm: 'admin' | 'member' (direct = null).
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const permissionAddMember =
    (activeRoom?.permission_add_member as string | null) ?? 'admin';
  const adminOnlyAdd = permissionAddMember === 'admin';
  const canAddMembers = !isDirect && (isCurrentUserAdmin || !adminOnlyAdd);
  const existingMemberIds: string[] = (activeRoom?.members || []).map(
    (m: any) => m.id,
  );

  const handleSetAddPermission = (next: 'admin' | 'member') => {
    updatePermissionMutation.mutate(
      { data: { id: roomId, new_permission_add_member: next as any } },
      {
        onSuccess: () => {
          patchChatRoomInCaches(queryClient, roomId, {
            permission_add_member: next,
          });
          toast({
            title: 'Thành công',
            description:
              next === 'admin'
                ? 'Chỉ quản trị viên được thêm thành viên'
                : 'Mọi thành viên đều được thêm thành viên',
          });
        },
        onError: () => {
          toast({
            title: 'Lỗi',
            description: 'Không thể đổi quyền thêm thành viên',
            variant: 'destructive',
          });
        },
      },
    );
  };

  // Fetch relation info between currentUser and otherMember to know if we blocked them
  const otherMember = activeRoom?.members?.find(
    (m: any) => m.id !== currentUser?.id,
  );

  const { data: relationRes } = useRelationsControllerGetRelation(
    otherMember?.id || '',
    {
      query: { enabled: !!otherMember?.id },
    },
  );

  const blockedByMe = (relationRes as any)?.data === 'block';

  useEffect(() => {
    if (!activeRoom) return;
    setGroupNameInput(activeRoom.name || '');
    if (pendingMuteRef.current === null) {
      const nextMuted = activeRoom.is_muted || false;
      setLocalIsMuted(nextMuted);
      lastCommittedMuteRef.current = nextMuted;
    }
    setAvatarPreview(null);
  }, [
    activeRoom?.id,
    activeRoom?.name,
    activeRoom?.avatar,
    activeRoom?.is_muted,
  ]);

  useEffect(
    () => () => {
      if (muteTimeoutRef.current) {
        clearTimeout(muteTimeoutRef.current);
      }
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    },
    [avatarPreview],
  );

  if (!activeRoom) return null;

  // Trạng thái mute hiện tại của bản thân
  const isMuted = localIsMuted;
  const currentEmoji = activeRoom.quick_emoji || '👍';

  const handleToggleMute = (checked: boolean) => {
    setLocalIsMuted(checked);
    pendingMuteRef.current = checked;
    patchChatRoomInCaches(queryClient, roomId, { is_muted: checked });

    if (muteTimeoutRef.current) {
      clearTimeout(muteTimeoutRef.current);
    }

    const requestSeq = ++muteRequestSeqRef.current;
    muteTimeoutRef.current = setTimeout(() => {
      updateSettingsMutation.mutate(
        {
          id: roomId,
          data: { is_muted: checked },
        },
        {
          onSuccess: () => {
            if (requestSeq !== muteRequestSeqRef.current) return;
            lastCommittedMuteRef.current = checked;
            pendingMuteRef.current = null;
            toast({
              title: checked ? 'Đã tắt thông báo' : 'Đã bật thông báo',
              description: `Bạn sẽ ${checked ? 'không nhận' : 'nhận'} thông báo đẩy từ cuộc trò chuyện này.`,
            });
          },
          onError: () => {
            if (requestSeq !== muteRequestSeqRef.current) return;
            const rollbackValue = lastCommittedMuteRef.current;
            pendingMuteRef.current = null;
            setLocalIsMuted(rollbackValue);
            patchChatRoomInCaches(queryClient, roomId, {
              is_muted: rollbackValue,
            });
            toast({
              title: 'Lỗi',
              description: 'Không thể cập nhật cài đặt thông báo',
              variant: 'destructive',
            });
          },
        },
      );
    }, 500);
  };

  const handleGroupPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    patchChatRoomInCaches(queryClient, roomId, { avatar: previewUrl });

    updateRoomMutation.mutate(
      {
        data: {
          id: roomId,
          name: activeRoom.name,
          'avatar-chat-room': file,
        } as any,
      },
      {
        onSuccess: (response: any) => {
          const updatedRoom = response?.data?.room || response?.room;
          if (updatedRoom) {
            upsertChatRoomInCaches(queryClient, updatedRoom, currentUser?.id);
          } else {
            queryClient.invalidateQueries({
              queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
            });
          }
          setAvatarPreview(null);
          toast({
            title: 'Cập nhật ảnh nhóm thành công',
          });
        },
        onError: () => {
          setAvatarPreview(null);
          patchChatRoomInCaches(queryClient, roomId, {
            avatar: activeRoom.avatar,
          });
          toast({
            title: 'Lỗi',
            description: 'Không thể cập nhật ảnh nhóm',
            variant: 'destructive',
          });
        },
      },
    );
  };

  // 2. Xử lý thay đổi quick emoji
  const handleChangeEmoji = (emoji: string) => {
    const previousEmoji = currentEmoji;
    patchChatRoomInCaches(queryClient, roomId, { quick_emoji: emoji });

    updateEmojiMutation.mutate(
      {
        id: roomId,
        data: { emoji },
      },
      {
        onSuccess: () => {
          toast({
            title: `Đã đổi biểu tượng cảm xúc thành ${emoji}`,
          });
        },
        onError: () => {
          patchChatRoomInCaches(queryClient, roomId, {
            quick_emoji: previousEmoji,
          });
          toast({
            title: 'Không thể đổi biểu tượng cảm xúc',
            variant: 'destructive',
          });
        },
      },
    );
  };

  // 3. Delete Chat history handler — follows Rules 1, 2, 3
  const handleDeleteChat = () => {
    deleteHistoryMutation.mutate(
      { id: roomId },
      {
        onSuccess: () => {
          const clearedAt = new Date().toISOString();

          // ── Quy tắc 1: Lọc tin nhắn sử dụng cleared_at, không bao giờ splice/pop/assign[] (tức là không bao giờ sửa đổi mảng gốc) ──
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
                    (m: any) => new Date(m.created_at) > new Date(clearedAt),
                  ),
                },
              };
            },
          );

          removeChatRoomFromCaches(queryClient, roomId);

          // ── Luật 2: Realtime safety — Tin nhắn mới từ WebSocket sẽ
          //    được appended bởi global handleNewMessage listener, và cũng
          //    gọi invalidateQueries trong danh sách phòng chat, do đó phòng
          //    sẽ tự động xuất hiện lại trong sidebar. ──

          toast({
            title: 'Đã xóa cuộc trò chuyện',
            description: 'Lịch sử cuộc trò chuyện đã bị xóa phía bạn.',
          });

          // - Luật 3: Sau khi xóa, điều hướng về /messages và đóng Drawer (Drawer là con của /messages, tức là cái cửa sổ chat đang mở). Nếu không, Drawer sẽ vẫn hiển thị nhưng phòng chat đã bị xóa khỏi cache, dẫn đến lỗi. -
          navigate('/messages');
          if (onClose) onClose();
        },
        onError: () => {
          toast({
            title: 'Lỗi',
            description: 'Không thể xóa cuộc trò chuyện',
            variant: 'destructive',
          });
        },
      },
    );
  };

  // 4. Block / Restrict handlers
  const handleRestrict = () => {
    if (!otherMember) return;
    updateRelationMutation.mutate(
      { data: { user_id: otherMember.id, action: 'restrict' as any } },
      {
        onSuccess: () => {
          toast({
            title: 'Đã hạn chế người dùng',
            description: 'Tin nhắn của họ sẽ được chuyển vào mục spam/chờ.',
          });
          navigate('/messages');
          if (onClose) onClose();
        },
        onError: () => {
          toast({
            title: 'Lỗi',
            description: 'Không thể thực hiện tác vụ',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleBlockUnblock = () => {
    if (!otherMember) return;
    if (blockedByMe) {
      unblockMutation.mutate(otherMember.id, {
        onSuccess: () => {
          if (onClose) onClose();
        },
      });
    } else {
      blockMutation.mutate(otherMember.id, {
        onSuccess: () => {
          navigate('/messages');
          if (onClose) onClose();
        },
      });
    }
  };

  const handleLeaveGroup = () => {
    removeChatRoomFromCaches(queryClient, roomId);
    leaveRoomMutation.mutate(
      { chatRoomId: roomId },
      {
        onSuccess: () => {
          toast({
            title: 'Đã rời nhóm',
            description: 'Bạn không còn nhận tin nhắn từ nhóm này nữa.',
          });
          navigate('/messages');
          if (onClose) onClose();
        },
        onError: () => {
          queryClient.invalidateQueries({
            queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
          });
          toast({
            title: 'Lỗi',
            description: 'Không thể rời nhóm',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleSaveGroupName = () => {
    const nextName = groupNameInput.trim();
    if (!nextName || nextName === activeRoom.name) {
      setIsEditingName(false);
      setGroupNameInput(activeRoom.name || '');
      return;
    }

    const previousName = activeRoom.name;
    patchChatRoomInCaches(queryClient, roomId, { name: nextName });

    updateRoomMutation.mutate(
      {
        data: {
          id: roomId,
          name: nextName,
        } as any,
      },
      {
        onSuccess: (response: any) => {
          const updatedRoom = response?.data?.room || response?.room;
          if (updatedRoom) {
            upsertChatRoomInCaches(queryClient, updatedRoom, currentUser?.id);
          } else {
            queryClient.invalidateQueries({
              queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
            });
          }
          setIsEditingName(false);
          toast({ title: 'Thành công', description: 'Đã đổi tên nhóm' });
        },
        onError: () => {
          patchChatRoomInCaches(queryClient, roomId, { name: previousName });
          setGroupNameInput(previousName || '');
          toast({
            title: 'Lỗi',
            description: 'Không thể đổi tên nhóm',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card text-card-foreground">
      {/* Header Info Drawer */}
      <div className="p-6 flex flex-col items-center border-b border-border/50 gap-3">
        <div className="relative group w-20 h-20">
          <Avatar className="w-20 h-20 shadow-md">
            <AvatarImage
              src={
                isDirect
                  ? getUserAvatarUrl(otherMember)
                  : avatarPreview || getGroupAvatarUrl(activeRoom.avatar)
              }
              className="object-cover"
            />
            <AvatarFallback className="bg-muted" />
          </Avatar>
          {!isDirect && (
            <>
              <div
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-6 h-6 text-white" />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleGroupPhotoChange}
              />
            </>
          )}
        </div>
        <div className="text-center">
          {isEditingName && !isDirect ? (
            <div className="flex flex-col items-center gap-2">
              <input
                value={groupNameInput}
                onChange={(event) => setGroupNameInput(event.target.value)}
                maxLength={30}
                className="w-[220px] rounded-lg border border-border bg-background px-3 py-2 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  disabled={updateRoomMutation.isPending}
                  onClick={handleSaveGroupName}
                >
                  Lưu
                </button>
                <button
                  className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold"
                  onClick={() => {
                    setIsEditingName(false);
                    setGroupNameInput(activeRoom.name || '');
                  }}
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h3 className="font-bold text-lg leading-tight truncate max-w-[240px]">
                {isDirect ? getDisplayName(otherMember) : activeRoom.name}
              </h3>
              {!isDirect && (
                <button
                  className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditingName(true)}
                  title="Đổi tên nhóm"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Options List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
        {/* Section 1: Settings */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
            Cấu hình phòng
          </h4>

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
            <Switch checked={isMuted} onCheckedChange={handleToggleMute} />
          </div>

          {/* Quick emoji selection */}
          <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <Smile className="w-5 h-5 text-muted-foreground" />
              <div className="text-sm font-medium">
                Biểu tượng cảm xúc nhanh
              </div>
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
              <span className="text-sm font-medium">
                Thành viên ({activeRoom.members?.length || 0})
              </span>
            </div>
            {isMembersOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isMembersOpen && (
            <div className="pl-4 space-y-2.5 flex-1 overflow-y-auto custom-scrollbar pt-1 pb-2">
              {/* Nút thêm thành viên (khi có quyền) */}
              {canAddMembers && (
                <button
                  onClick={() => setAddMembersOpen(true)}
                  className="w-full flex items-center gap-2.5 pr-2 group text-primary hover:opacity-80 transition-opacity"
                >
                  <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold">Thêm thành viên</span>
                </button>
              )}

              {/* Toggle quyền thêm thành viên (chỉ admin) */}
              {isCurrentUserAdmin && (
                <div className="flex items-center justify-between pr-2 py-1">
                  <span className="text-xs text-muted-foreground">
                    Chỉ quản trị viên được thêm thành viên
                  </span>
                  <Switch
                    checked={adminOnlyAdd}
                    disabled={updatePermissionMutation.isPending}
                    onCheckedChange={(checked) =>
                      handleSetAddPermission(checked ? 'admin' : 'member')
                    }
                  />
                </div>
              )}

              {activeRoom.members?.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between pr-2 group"
                >
                  <div
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/profile/${member.id}`)}
                  >
                    <Avatar className="w-7 h-7 hover:ring-2 hover:ring-primary/50 transition-all">
                      <AvatarImage
                        src={getUserAvatarUrl(member)}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-muted" />
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate max-w-[130px] hover:underline">
                        {getDisplayName(member)}
                      </p>
                      {!isDirect && (
                        <p className="text-[10px] text-muted-foreground capitalize flex items-center gap-1">
                          {(member.member_type === 'ADMIN' ||
                            member.member_type === 'admin') && (
                            <Crown className="w-3 h-3 text-amber-500" />
                          )}
                          {member.member_type === 'admin'
                            ? 'ADMIN'
                            : member.member_type || 'Thành viên'}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isDirect &&
                    isCurrentUserAdmin &&
                    member.id !== currentUser?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-xl"
                        >
                          {member.member_type !== 'ADMIN' &&
                            member.member_type !== 'admin' && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  promoteAdminMutation.mutate(member.id, {
                                    onSuccess: () => {
                                      patchChatRoomInCaches(
                                        queryClient,
                                        roomId,
                                        {
                                          members: (
                                            activeRoom.members || []
                                          ).map((m: any) =>
                                            m.id === member.id
                                              ? { ...m, member_type: 'ADMIN' }
                                              : m,
                                          ),
                                        },
                                      );
                                      toast({
                                        title: 'Thành công',
                                        description: `Đã chỉ định ${member.username} làm quản trị viên.`,
                                      });
                                    },
                                    onError: () => {
                                      toast({
                                        title: 'Lỗi',
                                        description:
                                          'Không thể chỉ định quản trị viên',
                                        variant: 'destructive',
                                      });
                                    },
                                  });
                                }}
                              >
                                Chỉ định làm Quản trị viên
                              </DropdownMenuItem>
                            )}
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => {
                              removeMemberMutation.mutate(
                                {
                                  data: {
                                    chat_room_id: roomId,
                                    target_user_id: member.id,
                                  },
                                },
                                {
                                  onSuccess: () => {
                                    patchChatRoomInCaches(queryClient, roomId, {
                                      members: (
                                        activeRoom.members || []
                                      ).filter((m: any) => m.id !== member.id),
                                    });
                                    toast({
                                      title: 'Thành công',
                                      description: `Đã xóa ${member.username} khỏi nhóm.`,
                                    });
                                  },
                                  onError: () => {
                                    toast({
                                      title: 'Lỗi',
                                      description: 'Không thể xóa thành viên',
                                      variant: 'destructive',
                                    });
                                  },
                                },
                              );
                            }}
                          >
                            Xóa khỏi nhóm
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
                    Tin nhắn của người này sẽ được chuyển sang mục "Tin nhắn
                    chờ", đồng thời họ sẽ không thấy khi bạn online hoặc đã đọc
                    tin nhắn của họ.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRestrict}
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
                  className={`w-full justify-start gap-3 rounded-xl transition-colors ${
                    blockedByMe
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      : 'text-red-500 hover:text-red-600 hover:bg-red-500/10'
                  }`}
                >
                  {blockedByMe ? (
                    <Unlock className="w-5 h-5" />
                  ) : (
                    <Ban className="w-5 h-5" />
                  )}
                  <span>{blockedByMe ? 'Bỏ chặn' : 'Chặn tài khoản'}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {blockedByMe
                      ? 'Bỏ chặn người dùng này?'
                      : 'Chặn người dùng này?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {blockedByMe
                      ? 'Bạn có chắc chắn muốn bỏ chặn người dùng này không? Họ sẽ có thể xem bài viết của bạn và gửi tin nhắn cho bạn.'
                      : 'Họ sẽ không thể gửi tin nhắn, theo dõi hoặc xem bài viết của bạn. Hành động này không thể hoàn tác dễ dàng.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBlockUnblock}
                    className={
                      blockedByMe
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }
                  >
                    {blockedByMe ? 'Xác nhận' : 'Chặn'}
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
                  Thao tác này sẽ xóa bản sao của cuộc trò chuyện khỏi hộp thư
                  của bạn. Bạn không thể hoàn tác.
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

          {/* Leave Group button (Only for Group Chats) */}
          {!isDirect && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl"
                  disabled={leaveRoomMutation.isPending}
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Rời nhóm</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rời khỏi nhóm này?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn sẽ không nhận được tin nhắn mới từ nhóm này nữa, và mọi
                    người sẽ thấy bạn đã rời nhóm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLeaveGroup}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    Rời nhóm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <AddMembersModal
        roomId={roomId}
        open={addMembersOpen}
        onOpenChange={setAddMembersOpen}
        existingMemberIds={existingMemberIds}
      />
    </div>
  );
}
