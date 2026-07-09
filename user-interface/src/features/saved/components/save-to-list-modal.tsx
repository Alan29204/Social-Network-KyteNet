import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { Bookmark, FolderPlus, Loader2, Plus, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SaveToListModalProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface SaveList {
  id: string;
  name: string;
}

export function SaveToListModal({
  postId,
  open,
  onOpenChange,
  onSaved,
}: SaveToListModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: lists, isLoading } = useQuery({
    queryKey: ['save-lists'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get('/save-lists', {
        params: { page: 1, limit: 100 },
      });
      const payload = res?.data?.data ?? res?.data;
      return (payload?.data ?? payload ?? []) as SaveList[];
    },
    enabled: open,
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await AXIOS_INSTANCE.post('/save-lists', { name });
      const payload = res?.data?.data ?? res?.data;
      return (payload?.data ?? payload) as SaveList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['save-lists'] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (saveListId: string) => {
      await AXIOS_INSTANCE.post('/save-posts', {
        post_id: postId,
        save_list_id: saveListId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
      toast({ description: 'Đã lưu bài viết' });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message || 'Không thể lưu bài viết. Thử lại sau.';
      toast({ description: msg, variant: 'destructive' });
    },
  });

  const handleSaveToList = (listId: string) => {
    if (saveMutation.isPending) return;
    saveMutation.mutate(listId);
  };

  const handleCreateAndSave = async () => {
    if (!newName.trim()) return;
    const list = await createListMutation.mutateAsync(newName.trim());
    if (list?.id) {
      setNewName('');
      setCreating(false);
      handleSaveToList(list.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-kyte-blue" />
            Lưu vào bộ sưu tập
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-kyte-blue" />
            </div>
          ) : (lists?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Bạn chưa có danh sách nào. Hãy tạo một bộ sưu tập mới.
            </p>
          ) : (
            lists!.map((list) => (
              <button
                key={list.id}
                onClick={() => handleSaveToList(list.id)}
                disabled={saveMutation.isPending}
                className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors text-left disabled:opacity-50"
              >
                <span className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-kyte-blue/15 to-kyte-coral/15 flex items-center justify-center">
                    <Bookmark className="w-4 h-4 text-kyte-blue" />
                  </span>
                  <span className="font-medium text-sm">{list.name}</span>
                </span>
                {saveMutation.isPending &&
                saveMutation.variables === list.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-muted-foreground opacity-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Tạo bộ sưu tập mới */}
        {creating ? (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên bộ sưu tập mới"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAndSave()}
            />
            <Button
              onClick={handleCreateAndSave}
              disabled={
                !newName.trim() ||
                createListMutation.isPending ||
                saveMutation.isPending
              }
            >
              {createListMutation.isPending || saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors text-kyte-blue font-medium text-sm border-t border-border"
          >
            <FolderPlus className="w-5 h-5" />
            Tạo bộ sưu tập mới
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
