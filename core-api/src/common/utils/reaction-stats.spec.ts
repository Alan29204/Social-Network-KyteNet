import { computeReactionStats } from './reaction-stats';
import { ReactionType } from '../enums/reaction.enum';

describe('computeReactionStats', () => {
  it('returns an empty, zeroed result for null/undefined/[]', () => {
    for (const input of [null, undefined, []] as any[]) {
      const stats = computeReactionStats(input);
      expect(stats.total).toBe(0);
      expect(stats.myReaction).toBeNull();
      // Mọi loại cảm xúc đều được khởi tạo về 0.
      for (const t of Object.values(ReactionType)) {
        expect(stats.breakdown[t]).toBe(0);
      }
    }
  });

  it('counts reactions grouped by type', () => {
    const stats = computeReactionStats([
      { reaction: 'like', user_id: 'u1' },
      { reaction: 'love', user_id: 'u2' },
      { reaction: 'like', user_id: 'u3' },
    ]);
    expect(stats.total).toBe(3);
    expect(stats.breakdown.like).toBe(2);
    expect(stats.breakdown.love).toBe(1);
  });

  it('ignores hidden reactions (is_hidden = true from block-sweep)', () => {
    const stats = computeReactionStats([
      { reaction: 'like', user_id: 'u1', is_hidden: true },
      { reaction: 'like', user_id: 'u2' },
    ]);
    expect(stats.total).toBe(1);
    expect(stats.breakdown.like).toBe(1);
  });

  it('ignores unknown/invalid reaction types', () => {
    const stats = computeReactionStats([{ reaction: 'not-a-type', user_id: 'u1' }]);
    expect(stats.total).toBe(0);
  });

  it('reports the viewer own reaction only for the matching user_id', () => {
    const reactions = [
      { reaction: 'love', user_id: 'me' },
      { reaction: 'like', user_id: 'other' },
    ];
    expect(computeReactionStats(reactions, 'me').myReaction).toBe('love');
    expect(computeReactionStats(reactions, 'nobody').myReaction).toBeNull();
  });
});
