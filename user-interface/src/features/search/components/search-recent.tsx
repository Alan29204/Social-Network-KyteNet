import { Clock, X, Search } from 'lucide-react';

interface SearchRecentProps {
  history: string[];
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
}

/**
 * Hiển thị lịch sử tìm kiếm gần đây khi ô tìm kiếm còn trống.
 */
export function SearchRecent({
  history,
  onSelect,
  onRemove,
  onClear,
}: SearchRecentProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Search className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">
          Tìm kiếm người dùng, bài viết, hashtag
        </p>
        <p className="text-xs mt-1 opacity-70">
          Nhập từ khóa để bắt đầu khám phá
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 mb-1">
        <span className="text-sm font-semibold">Gần đây</span>
        <button
          onClick={onClear}
          className="text-xs text-primary font-semibold hover:text-primary/80"
        >
          Xóa tất cả
        </button>
      </div>
      {history.map((term) => (
        <div
          key={term}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <button
            onClick={() => onSelect(term)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
          >
            <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
            <span className="text-sm truncate">{term}</span>
          </button>
          <button
            onClick={() => onRemove(term)}
            className="p-1 rounded-full hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Xóa"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );
}
