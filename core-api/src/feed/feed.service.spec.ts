import { FeedService } from './feed.service';
import { PrivacyType } from '../common/enums/privacy.enum';

/**
 * Unit test cho phần logic THUẦN (không chạm DB/Redis) của FeedService:
 * bộ lọc quyền riêng tư và pass đa dạng tác giả. Service được khởi tạo với các
 * dependency null vì các method dưới đây chỉ dùng tham số truyền vào.
 */
describe('FeedService (pure logic)', () => {
  const service = new FeedService(
    null as any,
    null as any,
    null as any,
    null as any,
  );

  // applyPrivacyFilter là private -> gọi qua cast any (kiểm thử hành vi).
  const filter = (
    posts: any[],
    userId: string,
    blocked: string[],
    following: string[],
  ) => (service as any).applyPrivacyFilter(posts, userId, blocked, following);

  const post = (over: Partial<any> = {}) => ({
    id: 'p',
    user_id: 'author',
    privacy: PrivacyType.PUBLIC,
    user: { id: 'author', privacy: PrivacyType.PUBLIC },
    shared_post: null,
    ...over,
  });

  describe('applyPrivacyFilter', () => {
    it('keeps a public post from a non-blocked public account', () => {
      const result = filter([post()], 'me', [], []);
      expect(result).toHaveLength(1);
    });

    it('always shows the owner their own post, even if private', () => {
      const own = post({
        user_id: 'me',
        privacy: PrivacyType.PRIVATE,
        user: { id: 'me', privacy: PrivacyType.PRIVATE },
      });
      expect(filter([own], 'me', [], [])).toHaveLength(1);
    });

    it('removes posts authored by a blocked user', () => {
      const bad = post({ id: 'bad', user_id: 'bad', user: { id: 'bad', privacy: PrivacyType.PUBLIC } });
      const result = filter([post(), bad], 'me', ['bad'], []);
      expect(result.map((p: any) => p.id)).toEqual(['p']);
    });

    it('hides a post from a private account the viewer does not follow', () => {
      const priv = post({
        user_id: 'u4',
        user: { id: 'u4', privacy: PrivacyType.PRIVATE },
      });
      expect(filter([priv], 'me', [], [])).toHaveLength(0);
    });

    it('shows a FOLLOWER-privacy post only to followers', () => {
      const followerOnly = post({
        user_id: 'u5',
        privacy: PrivacyType.FOLLOWER,
        user: { id: 'u5', privacy: PrivacyType.PUBLIC },
      });
      expect(filter([followerOnly], 'me', [], ['u5'])).toHaveLength(1);
      expect(filter([followerOnly], 'me', [], [])).toHaveLength(0);
    });
  });

  describe('applyAuthorDiversity', () => {
    it('caps posts per author near the top and pushes overflow to the end', () => {
      const diversity = (svc: any, sorted: any[]) =>
        svc.applyAuthorDiversity(sorted);

      // 7 bài của tác giả A (giới hạn là 6) + 1 bài của B, đúng thứ tự đầu vào.
      const candidates = [
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `a${i + 1}`,
          authorId: 'A',
          hashtags: [],
          score: 0,
        })),
        { id: 'b1', authorId: 'B', hashtags: [], score: 0 },
      ];

      const result: string[] = diversity(service as any, candidates);

      expect(result).toHaveLength(8);
      // Bài thứ 7 của A bị đẩy xuống cuối (vượt ngưỡng 6/tác giả).
      expect(result[result.length - 1]).toBe('a7');
      // b1 đứng trước a7 (không bị đẩy xuống vì mới có 1 bài của B).
      expect(result.indexOf('b1')).toBeLessThan(result.indexOf('a7'));
    });
  });
});
