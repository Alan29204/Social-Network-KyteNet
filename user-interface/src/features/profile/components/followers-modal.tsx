import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface FollowersModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FollowersModal({ userId, isOpen, onClose }: FollowersModalProps) {
  // Temporary mock data
  const followers = [
    { id: '1', username: 'user1', name: 'User One', avatar: '' },
    { id: '2', username: 'user2', name: 'User Two', avatar: '' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center border-b pb-4">Người theo dõi</DialogTitle>
        </DialogHeader>
        <div className="p-2 relative">
          <Search className="w-4 h-4 absolute left-4 top-5 text-muted-foreground" />
          <Input placeholder="Tìm kiếm" className="pl-8 bg-muted/50 border-none" />
        </div>
        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto mt-2">
          {followers.map(f => (
            <div key={f.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border border-border">
                  <AvatarImage src={f.avatar || '/default-avatar.png'} className="object-cover" />
                  <AvatarFallback>{f.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-sm">
                  <span className="font-semibold">{f.username}</span>
                  <span className="text-muted-foreground">{f.name}</span>
                </div>
              </div>
              <Button variant="secondary" size="sm">Xóa</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
