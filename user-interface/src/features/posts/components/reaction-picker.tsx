import { Heart } from 'lucide-react';

export interface ReactionMeta {
  type: string;
  emoji: string;
  label: string;
  color: string;
}

/** 6 loại cảm xúc (Messenger/Facebook-style). Thứ tự hiển thị trong picker. */
export const REACTIONS: ReactionMeta[] = [
  { type: 'like', emoji: '👍', label: 'Thích', color: 'text-blue-500' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích', color: 'text-red-500' },
  { type: 'haha', emoji: '😂', label: 'Haha', color: 'text-yellow-500' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: 'text-yellow-500' },
  { type: 'sad', emoji: '😢', label: 'Buồn', color: 'text-yellow-500' },
  { type: 'angry', emoji: '😡', label: 'Phẫn nộ', color: 'text-orange-500' },
];

export const getReactionMeta = (type?: string | null): ReactionMeta | null =>
  REACTIONS.find((r) => r.type === type) || null;

interface ReactionPickerProps {
  /** Cảm xúc hiện tại của người dùng (my_reaction) hoặc null. */
  current?: string | null;
  /** Gọi khi chọn 1 loại (backend tự toggle nếu chọn lại cùng loại). */
  onReact: (type: string) => void;
  size?: 'sm' | 'md';
  /** Hiển thị nhãn chữ cạnh icon (dùng ở post detail). */
  showLabel?: boolean;
}

/**
 * Nút thả cảm xúc: click nhanh = toggle (thêm 👍 / gỡ cảm xúc hiện tại);
 * hover hiện hàng 6 emoji để chọn loại cụ thể.
 */
export function ReactionPicker({
  current,
  onReact,
  size = 'md',
  showLabel = false,
}: ReactionPickerProps) {
  const active = getReactionMeta(current);
  const iconCls = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const emojiCls = size === 'sm' ? 'text-[18px]' : 'text-[22px]';

  return (
    <div className="relative group inline-flex">
      {/*
        Popover 6 emoji.
        - `pb-2` là "cầu nối" phủ khoảng trống giữa nút và thanh -> di chuột lên
          không bị mất hover (thanh không biến mất).
        - Lùi sang trái (-left) để NÚT nằm giữa icon thứ 1 và thứ 2.
        - Hiện nhanh: opacity/translate + duration-100 (thay animation chậm).
      */}
      <div className="absolute bottom-full left-[-16px] pb-2 z-30 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-100 ease-out pointer-events-none group-hover:pointer-events-auto">
        <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2 py-1.5 shadow-xl">
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReact(r.type);
              }}
              title={r.label}
              className="text-2xl leading-none hover:scale-125 transition-transform duration-100"
            >
              {r.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Nút chính — click nhanh = mặc định "thả tim" (love). */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onReact(current || 'love');
        }}
        className={`flex items-center gap-1.5 font-semibold transition-colors ${
          active ? active.color : 'text-foreground/70 hover:text-red-400'
        }`}
        aria-label="Bày tỏ cảm xúc"
      >
        {active ? (
          <span className={emojiCls}>{active.emoji}</span>
        ) : (
          <Heart className={iconCls} />
        )}
        {showLabel && (
          <span className="text-sm">{active ? active.label : 'Thích'}</span>
        )}
      </button>
    </div>
  );
}

/** Dãy emoji tóm tắt (top loại) + tổng — hiển thị cạnh nút mở modal. */
export function ReactionSummary({
  breakdown,
  total,
}: {
  breakdown?: Record<string, number>;
  total: number;
}) {
  if (!total) return null;
  const top = REACTIONS.filter((r) => (breakdown?.[r.type] || 0) > 0)
    .sort((a, b) => (breakdown![b.type] || 0) - (breakdown![a.type] || 0))
    .slice(0, 3);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex -space-x-1">
        {top.map((r) => (
          <span key={r.type} className="text-sm leading-none">
            {r.emoji}
          </span>
        ))}
      </span>
      <span className="text-sm text-muted-foreground">{total}</span>
    </span>
  );
}
