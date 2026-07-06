import { ReactionType } from 'src/common/enums/reaction.enum';

export interface ReactionStats {
  /** Tổng số reaction (mọi loại, đã bỏ is_hidden). */
  total: number;
  /** Đếm theo từng loại: { like, love, haha, wow, sad, angry }. */
  breakdown: Record<string, number>;
  /** Loại cảm xúc của người xem hiện tại (hoặc null). */
  myReaction: string | null;
}

/**
 * Tính thống kê cảm xúc cho 1 bài viết từ mảng reactions đã load.
 * Bỏ qua reaction bị ẩn (is_hidden do block-sweep) và loại không hợp lệ.
 */
export function computeReactionStats(
  reactions: any[] | undefined | null,
  userId?: string,
): ReactionStats {
  const breakdown: Record<string, number> = {};
  for (const t of Object.values(ReactionType)) breakdown[t] = 0;

  let total = 0;
  let myReaction: string | null = null;

  for (const r of reactions || []) {
    if (!r || r.is_hidden) continue;
    const type = r.reaction as string;
    if (breakdown[type] === undefined) continue;
    breakdown[type] += 1;
    total += 1;
    if (userId && r.user_id === userId) myReaction = type;
  }

  return { total, breakdown, myReaction };
}
