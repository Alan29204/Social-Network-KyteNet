import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, X, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useUsersControllerSearchUsersForMessage,
  useChatRoomsControllerCreateChatRoom,
  useChatRoomsControllerGetOrCreateDirectChat,
  getChatRoomsControllerGetListChatRoomQueryKey,
} from '@/services/apis/gen/queries';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

interface CreateChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartDirectChat?: (targetUser: any) => void;
}

export function CreateChatModal({
  open,
  onOpenChange,
  onStartDirectChat,
}: CreateChatModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  // Quyền thêm thành viên cho nhóm mới (chỉ áp dụng khi tạo nhóm >=2 người).
  const [addPermission, setAddPermission] = useState<'admin' | 'member'>('admin');

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: searchResponse, isLoading: isSearching } =
    useUsersControllerSearchUsersForMessage(
      debouncedTerm ? { q: debouncedTerm } : undefined,
      {
        query: {
          enabled: true,
        },
      },
    );

  const searchResult = (searchResponse as any)?.data?.data || [];

  const { mutateAsync: createGroup } = useChatRoomsControllerCreateChatRoom();
  const { mutateAsync: getOrCreateDirect } =
    useChatRoomsControllerGetOrCreateDirectChat();

  const handleToggleUser = (targetUser: any) => {
    if (selectedUsers.find((u) => u.id === targetUser.id)) {
      setSelectedUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    } else {
      setSelectedUsers((prev) => [...prev, targetUser]);
    }
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) return;

    try {
      let newRoomId: string | undefined;

      if (selectedUsers.length === 1) {
        if (onStartDirectChat) {
          onStartDirectChat(selectedUsers[0]);
          onOpenChange(false);
          setSelectedUsers([]);
          setSearchTerm('');
          return;
        }

        // Direct chat
        const res = await getOrCreateDirect({
          targetUserId: selectedUsers[0].id,
        }) as any;
        // Response: { statusCode, message, data: { id, ... } }
        newRoomId = res?.data?.room_id || res?.room_id || res?.data?.id || res?.id;
      } else {
        // Group chat
        const res = await createGroup({
          data: {
            members: selectedUsers.map((u) => u.id),
            permission_add_member: addPermission,
          } as any,
        }) as any;
        // Response: { statusCode, message, data: { message, room_id } }
        newRoomId = res?.data?.room_id || res?.room_id;
      }

      // Invalidate sidebar to show the new room
      await queryClient.invalidateQueries({
        queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
      });

      if (newRoomId) {
        navigate(`/messages/${newRoomId}`);
      }

      onOpenChange(false);
      setSelectedUsers([]);
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-card border-none rounded-2xl">
        <DialogHeader className="px-4 py-3 border-b border-border/50 flex flex-row items-center justify-between">
          <div className="flex-1" />
          <DialogTitle className="text-[16px] font-bold text-center flex-1">Tin nhắn mới</DialogTitle>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleCreateChat}
              disabled={selectedUsers.length === 0}
              className={`text-[14px] font-semibold ${selectedUsers.length > 0 ? 'text-primary' : 'text-primary/50 cursor-not-allowed'}`}
            >
              Chat
            </button>
          </div>
        </DialogHeader>

        <div className="flex items-center px-4 py-2 border-b border-border/50">
          <span className="text-[15px] font-semibold mr-3 shrink-0">Tới:</span>
          <div className="flex flex-wrap items-center gap-2 flex-1 overflow-x-auto min-h-[30px]">
            {selectedUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-[14px]"
              >
                <span>{u.username}</span>
                <button
                  onClick={() => handleToggleUser(u)}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <input
              type="text"
              placeholder={selectedUsers.length === 0 ? "Tìm kiếm..." : ""}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[14px] min-w-[120px]"
            />
          </div>
        </div>

        {selectedUsers.length > 1 && (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/50">
            <span className="text-[13px] text-muted-foreground">
              Ai được thêm thành viên?
            </span>
            <div className="flex rounded-full bg-secondary/60 p-0.5 text-[13px] font-semibold">
              <button
                type="button"
                onClick={() => setAddPermission('admin')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  addPermission === 'admin'
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                Chỉ admin
              </button>
              <button
                type="button"
                onClick={() => setAddPermission('member')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  addPermission === 'member'
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                Mọi người
              </button>
            </div>
          </div>
        )}

        <div className="h-[300px] overflow-y-auto p-2">
          {isSearching ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : searchResult.length > 0 ? (
            <>
              {!debouncedTerm && (
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  Gợi ý cho bạn
                </div>
              )}
              {searchResult.map((u: any) => {
                const isSelected = selectedUsers.some(
                  (selected) => selected.id === u.id,
                );
                return (
                  <div
                    key={u.id}
                    onClick={() => handleToggleUser(u)}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="w-11 h-11">
                      <AvatarImage
                        src={u.profile_picture_url || u.avatar || '/default-avatar.png'}
                      />
                      <AvatarFallback>
                        {u.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold">{u.username}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {u.full_name || u.username}
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                );
              })}
            </>
          ) : debouncedTerm ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Không tìm thấy tài khoản.
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Không có gợi ý.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
