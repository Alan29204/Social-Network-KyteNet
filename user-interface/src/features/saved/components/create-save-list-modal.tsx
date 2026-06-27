import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { FolderPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateSaveListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSaveListModal({
  open,
  onOpenChange,
}: CreateSaveListModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: async (listName: string) => {
      await AXIOS_INSTANCE.post('/save-lists', { name: listName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['save-lists'] });
      toast({ description: 'Đã tạo bộ sưu tập' });
      setName('');
      onOpenChange(false);
    },
    onError: () => {
      toast({
        description: 'Không thể tạo bộ sưu tập. Thử lại sau.',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (!name.trim() || createMutation.isPending) return;
    createMutation.mutate(name.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-kyte-blue" />
            Tạo bộ sưu tập mới
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên bộ sưu tập"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Tạo'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
