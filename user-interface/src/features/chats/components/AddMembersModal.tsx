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
  useChatMembersControllerAddMembers,
  getChatMessagesControllerGetMessageHistoryQueryKey,
  getChatRoomsControllerGetListChatRoomQueryKey,
} from '@/services/apis/gen/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface AddMembersModalProps {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ID các thành viên hiện có để loại khỏi kết quả tìm kiếm. */
  existingMemberIds: string[];
}

/** Modal thêm thành viên vào nhóm chat (tìm + chọn nhiều người). */
export function AddMembersModal({
  roomId,
  open,
  onOpenChange,
  existingMemberIds,
}: AddMembersModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedTerm(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (!open) {
      setSelectedUsers([]);
      setSearchTerm('');
      setDebouncedTerm('');
    }
  }, [open]);

  const { data: searchResponse, isLoading: isSearching } =
    useUsersControllerSearchUsersForMessage(
      debouncedTerm ? { q: debouncedTerm } : undefined,
      { query: { enabled: open } },
    );

  const searchResult: any[] = ((searchResponse as any)?.data?.data || []).filter(
    (u: any) => !existingMemberIds.includes(u.id),
  );

  const { mutateAsync: addMembers, isPending } =
    useChatMembersControllerAddMembers();

  const handleToggleUser = (targetUser: any) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === targetUser.id)
        ? prev.filter((u) => u.id !== targetUser.id)
        : [...prev, targetUser],
    );
  };

  const handleAdd = async () => {
    if (selectedUsers.length === 0 || isPending) return;
    try {
      await addMembers({
        data: { chat_room_id: roomId, user_ids: selectedUsers.map((u) => u.id) },
      });
      toast({ description: 'Đã thêm thành viên vào nhóm' });
      queryClient.invalidateQueries({
        queryKey: getChatMessagesControllerGetMessageHistoryQueryKey(roomId),
      });
      queryClient.invalidateQueries({
        queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        description:
          e?.response?.data?.message ||
          e?.response?.data?.data?.message ||
          'Không thể thêm thành viên. Thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-card border-none rounded-2xl">
        <DialogHeader className="px-4 py-3 border-b border-border/50 flex flex-row items-center justify-between">
          <div className="flex-1" />
          <DialogTitle className="text-[16px] font-bold text-center flex-1">
            Thêm thành viên
          </DialogTitle>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleAdd}
              disabled={selectedUsers.length === 0 || isPending}
              className={`text-[14px] font-semibold ${
                selectedUsers.length > 0 && !isPending
                  ? 'text-primary'
                  : 'text-primary/50 cursor-not-allowed'
              }`}
            >
              {isPending ? 'Đang thêm...' : 'Thêm'}
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
              placeholder={selectedUsers.length === 0 ? 'Tìm kiếm...' : ''}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[14px] min-w-[120px]"
            />
          </div>
        </div>

        <div className="h-[300px] overflow-y-auto p-2">
          {isSearching ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : searchResult.length > 0 ? (
            searchResult.map((u: any) => {
              const isSelected = selectedUsers.some((s) => s.id === u.id);
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
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              );
            })
          ) : debouncedTerm ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Không tìm thấy tài khoản.
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nhập tên để tìm người thêm vào nhóm.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
