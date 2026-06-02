import { Plus } from 'lucide-react';

export function SavedCollections({ userId: _userId }: { userId: string }) {
  // TODO: Fetch collections from API: GET /save-lists
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-4">
      {/* Create New Collection Button */}
      <button className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:bg-muted/50 transition-colors">
        <Plus className="w-8 h-8 text-muted-foreground mb-2" />
        <span className="text-sm font-medium text-muted-foreground">Tạo bộ sưu tập mới</span>
      </button>

      {/* Placeholder Collections */}
      <div className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer border bg-muted">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
        <div className="absolute bottom-3 left-3 z-20 text-white font-medium">Tất cả bài viết</div>
      </div>
      
      <div className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer border bg-muted">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
        <div className="absolute bottom-3 left-3 z-20 text-white font-medium">Món ngon</div>
      </div>
    </div>
  );
}
