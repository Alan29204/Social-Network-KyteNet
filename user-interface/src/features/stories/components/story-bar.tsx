import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useStoryFeed } from '../api';
import { StoryViewer } from './story-viewer';
import { CreateStoryModal } from './create-story-modal';
import type { StoryGroup } from '../types';
import { getDisplayName, getAvatarUrl } from '@/utils/user';

export function StoryBar() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: groups = [], isLoading } = useStoryFeed();

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Story của chính mình (nếu có)
  const myGroup = groups.find((g: StoryGroup) => g.user.id === currentUser?.id);

  return (
    <>
      <div className="px-4 sm:px-0 mb-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {/* Ô tạo story / story của mình */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={() =>
                myGroup
                  ? setViewerIndex(groups.indexOf(myGroup))
                  : setCreateOpen(true)
              }
              className="relative"
            >
              <div
                className={`w-[92px] h-[92px] rounded-full p-[3px] ${
                  myGroup
                    ? 'bg-gradient-to-br from-kyte-blue to-kyte-coral'
                    : 'bg-border'
                }`}
              >
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                  <Avatar className="w-[86px] h-[86px]">
                    <AvatarImage src={getAvatarUrl(currentUser?.avatar)} />
                    <AvatarFallback className="bg-muted" />
                  </Avatar>
                </div>
              </div>
              {/* Nút + tạo story */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreateOpen(true);
                }}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-kyte-blue text-white flex items-center justify-center border-[2.5px] border-background"
                aria-label="Tạo story"
              >
                <Plus className="w-4 h-4" />
              </button>
            </button>
            <span className="text-[10px] text-muted-foreground">
              Tin của bạn
            </span>
          </div>

          {/* Skeleton khi đang tải */}
          {isLoading &&
            [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div className="w-[92px] h-[92px] rounded-full bg-secondary animate-pulse" />
                <div className="w-14 h-2 rounded bg-secondary animate-pulse" />
              </div>
            ))}

          {/* Story của người khác */}
          {groups
            .filter((g: StoryGroup) => g.user.id !== currentUser?.id)
            .map((group: StoryGroup) => {
              const realIndex = groups.indexOf(group);
              return (
                <div
                  key={group.user.id}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <button onClick={() => setViewerIndex(realIndex)}>
                    <div
                      className={`w-[92px] h-[92px] rounded-full p-[3px] ${
                        group.has_unseen
                          ? 'bg-gradient-to-br from-kyte-blue to-kyte-coral'
                          : 'bg-border'
                      }`}
                    >
                      <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                        <Avatar className="w-[86px] h-[86px]">
                          <AvatarImage src={getAvatarUrl(group.user.avatar)} />
                          <AvatarFallback className="bg-muted" />
                        </Avatar>
                      </div>
                    </div>
                  </button>
                  <span className="text-[10px] text-muted-foreground max-w-[92px] truncate px-1">
                    {getDisplayName(group.user)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      <CreateStoryModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}
