import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Grid3X3, Image as ImageIcon, PlaySquare, Bookmark, Repeat } from 'lucide-react';
import { AllPostsList } from './post-lists/all-posts-list';
import { MediaPostsGrid } from './post-lists/media-posts-grid';
import { VideoPostsGrid } from './post-lists/video-posts-grid';
import { SavedCollections } from './post-lists/saved-collections';
import { RepostedPostsGrid } from './post-lists/reposted-posts-grid';
import { useAuthStore } from '@/features/auth/stores/auth-store';

interface ProfileTabsProps {
  userId: string;
}

export function ProfileTabs({ userId }: ProfileTabsProps) {
  const { user: currentUser } = useAuthStore();
  const isMe = currentUser?.id === userId;

  const tabs = [
    { value: 'all', icon: <Grid3X3 className="w-5 h-5" />, label: 'BÀI VIẾT', content: <AllPostsList userId={userId} /> },
    { value: 'media', icon: <ImageIcon className="w-5 h-5" />, label: 'MEDIA', content: <MediaPostsGrid userId={userId} /> },
    { value: 'video', icon: <PlaySquare className="w-5 h-5" />, label: 'VIDEO', content: <VideoPostsGrid userId={userId} /> },
  ];

  if (isMe) {
    tabs.push({ value: 'saved', icon: <Bookmark className="w-5 h-5" />, label: 'ĐÃ LƯU', content: <SavedCollections userId={userId} /> });
    tabs.push({ value: 'reposts', icon: <Repeat className="w-5 h-5" />, label: 'ĐĂNG LẠI', content: <RepostedPostsGrid userId={userId} /> });
  } else {
    tabs.push({ value: 'reposts', icon: <Repeat className="w-5 h-5" />, label: 'ĐĂNG LẠI', content: <RepostedPostsGrid userId={userId} /> });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full justify-center gap-12 bg-transparent h-14 border-b rounded-none mb-6">
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.value} 
              value={tab.value}
              className="data-[state=active]:border-t-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 h-full bg-transparent data-[state=active]:bg-transparent"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center w-12 h-12">
                    {tab.icon}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tab.label}</p>
                </TooltipContent>
              </Tooltip>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="focus-visible:outline-none focus-visible:ring-0">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </TooltipProvider>
  );
}
