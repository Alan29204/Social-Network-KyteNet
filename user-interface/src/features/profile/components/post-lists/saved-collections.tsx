import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { Bookmark, FolderPlus, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react';
import { CreateSaveListModal } from '@/features/saved/components/create-save-list-modal';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';

interface SaveListItem {
  id: string;
  name: string;
  cover?: string | null;
  count?: number;
}

export function SavedCollections({ userId: _userId }: { userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SaveListItem | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SaveListItem | null>(null);

  // Danh sách bộ sưu tập do người dùng tạo (đã kèm cover + count, KHÔNG gồm "Đã lưu" mặc định)
  const { data: lists, isLoading: loadingLists } = useQuery({
    queryKey: ['save-lists'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get('/save-lists', {
        params: { page: 1, limit: 100 },
      });
      const body = res?.data?.data ?? res?.data;
      return (body?.data ?? body ?? []) as SaveListItem[];
    },
  });

  // Tóm tắt bộ sưu tập mặc định "Tất cả đã lưu" (cover + tổng số)
  const { data: allSaved, isLoading: loadingAll } = useQuery({
    queryKey: ['saved-summary'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get('/save-posts/me/list', {
        params: { page: 1, limit: 1 },
      });
      const body = res?.data?.data ?? res?.data;
      const first = body?.data?.[0];
      const medias = first?.post?.medias ?? first?.medias ?? [];
      return {
        cover: Array.isArray(medias) && medias.length > 0 ? medias[0] : null,
        count: body?.meta?.total ?? 0,
      } as { cover: string | null; count: number };
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await AXIOS_INSTANCE.put(`/save-lists/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['save-lists'] });
      toast({ description: 'Đã đổi tên bộ sưu tập' });
      setRenameTarget(null);
    },
    onError: () =>
      toast({ description: 'Không thể đổi tên. Thử lại sau.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await AXIOS_INSTANCE.delete(`/save-lists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['save-lists'] });
      toast({ description: 'Đã xóa bộ sưu tập' });
      setDeleteTarget(null);
    },
    onError: () =>
      toast({ description: 'Không thể xóa. Thử lại sau.', variant: 'destructive' }),
  });

  const isLoading = loadingLists || loadingAll;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const renderCover = (cover?: string | null, label?: string) =>
    cover ? (
      <img
        src={cover}
        alt={label || 'cover'}
        className="absolute inset-0 w-full h-full object-cover"
      />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-muted">
        <Bookmark className="w-10 h-10 text-muted-foreground/40" />
      </div>
    );

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-4">
        {/* Nút tạo bộ sưu tập mới */}
        <button
          onClick={() => setCreateOpen(true)}
          className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:bg-muted/50 transition-colors"
        >
          <FolderPlus className="w-8 h-8 text-muted-foreground mb-2" />
          <span className="text-sm font-medium text-muted-foreground">
            Tạo bộ sưu tập mới
          </span>
        </button>

        {/* Bộ sưu tập "Tất cả bài đã lưu" (mặc định) */}
        <div
          className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer border"
          onClick={() => navigate('/saved')}
        >
          {renderCover(allSaved?.cover, 'Tất cả')}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
          <div className="absolute bottom-3 left-3 z-20 text-white font-medium">
            Tất cả ({allSaved?.count || 0})
          </div>
        </div>

        {/* Các bộ sưu tập của user */}
        {(lists || []).map((list) => (
          <div
            key={list.id}
            className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer border"
            onClick={() =>
              navigate(
                `/saved?listId=${list.id}&name=${encodeURIComponent(list.name)}`,
              )
            }
          >
            {renderCover(list.cover, list.name)}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />

            {/* Menu đổi tên / xóa */}
            <div
              className="absolute top-2 right-2 z-30"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Tùy chọn bộ sưu tập"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setRenameName(list.name);
                      setRenameTarget(list);
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Đổi tên
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(list)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="absolute bottom-3 left-3 z-20 text-white font-medium truncate max-w-[80%]">
              {list.name} {typeof list.count === 'number' && `(${list.count})`}
            </div>
          </div>
        ))}
      </div>

      <CreateSaveListModal open={createOpen} onOpenChange={setCreateOpen} />

      {/* Modal đổi tên */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đổi tên bộ sưu tập</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <Input
              autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Tên bộ sưu tập"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameTarget && renameName.trim()) {
                  renameMutation.mutate({
                    id: renameTarget.id,
                    name: renameName.trim(),
                  });
                }
              }}
            />
            <Button
              onClick={() =>
                renameTarget &&
                renameName.trim() &&
                renameMutation.mutate({
                  id: renameTarget.id,
                  name: renameName.trim(),
                })
              }
              disabled={!renameName.trim() || renameMutation.isPending}
              className="w-full"
            >
              {renameMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Lưu'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Xác nhận xóa */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Xóa bộ sưu tập này?"
        description={`Bộ sưu tập "${deleteTarget?.name ?? ''}" sẽ bị xóa. Các bài viết vẫn còn trong "Tất cả đã lưu".`}
        confirmText="Xóa"
        destructive
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </>
  );
}
