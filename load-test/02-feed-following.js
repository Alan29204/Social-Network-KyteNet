/**
 * KỊCH BẢN 2 — BẢNG TIN THEO DÕI  ★ ĐÂY LÀ PHÉP ĐO CHO ĐÓNG GÓP FAN-OUT LAI ★
 *
 * Đây là kịch bản có giá trị nhất cho đồ án: nó chứng minh bằng SỐ rằng cơ chế
 * fan-out lai hoạt động, thay vì chỉ nói suông.
 *
 * Cái cần chứng minh:
 *   1. Đọc bảng tin đã dựng sẵn trong Redis là O(log n + k) → độ trễ p95 phải
 *      GẦN NHƯ KHÔNG ĐỔI khi tăng tải (khác hẳn truy vấn tổng hợp trên DB).
 *   2. Nhánh "celebrity" (fan-out on read) đắt hơn nhánh thường bao nhiêu.
 *      Seed có sẵn KOL `traveler1@vn.seed` với ĐÚNG 500 follower = ngưỡng
 *      CELEBRITY_THRESHOLD → những ai theo dõi KOL sẽ phải trộn thêm
 *      celebrity_posts khi đọc feed.
 *   3. Phân trang sâu (cuộn vô hạn) có bị chậm dần không.
 *
 * ĐIỂM NGHI NGỜ ĐÃ BIẾT (hãy chú ý khi đọc kết quả):
 *   - getCelebrityPostIds() lặp `for` và gọi Redis GET cho TỪNG người đang theo
 *     dõi → 5–15 round-trip Redis mỗi lần đọc feed. Đây là ứng viên N+1 số 1.
 *   - getPostsByIds() nạp 7 relations, kéo TOÀN BỘ row reaction/comment chỉ để
 *     đếm .length → bài viral sẽ kéo hàng nghìn row.
 *
 * Chạy (sau khi đã 00-warmup):
 *   k6 run load-test/02-feed-following.js
 *   k6 run -e VUS=200 load-test/02-feed-following.js     # đẩy tải cao hơn
 */
import http from 'k6/http';
import { check, group } from 'k6';
import { Trend } from 'k6/metrics';
import {
  BASE_URL,
  emailOf,
  login,
  TOTAL_SEED_USERS,
  DEFAULT_THRESHOLDS,
} from './lib/common.js';

const PEAK_VUS = Number(__ENV.VUS || 100);
const POOL = Number(__ENV.POOL || 200); // số user đăng nhập sẵn ở setup()

/** Tách riêng độ trễ trang đầu và trang sau — để chứng minh cuộn không chậm dần. */
const firstPage = new Trend('feed_first_page_ms', true);
const deepPage = new Trend('feed_deep_page_ms', true);

export const options = {
  scenarios: {
    // Tăng tải theo bậc thang: nếu p95 gần như phẳng qua các bậc → chứng minh
    // được độ phức tạp O(log n + k) của Sorted Set.
    stairs: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.round(PEAK_VUS * 0.25) },
        { duration: '1m', target: Math.round(PEAK_VUS * 0.25) },
        { duration: '30s', target: Math.round(PEAK_VUS * 0.5) },
        { duration: '1m', target: Math.round(PEAK_VUS * 0.5) },
        { duration: '30s', target: PEAK_VUS },
        { duration: '2m', target: PEAK_VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: Object.assign({}, DEFAULT_THRESHOLDS, {
    'http_req_duration{name:GET /feed/following}': ['p(95)<400', 'p(99)<800'],
    feed_first_page_ms: ['p(95)<400'],
    feed_deep_page_ms: ['p(95)<500'],
  }),
};

export function setup() {
  const tokens = [];
  for (let i = 2; i < 2 + POOL && i <= TOTAL_SEED_USERS; i++) {
    tokens.push(login(emailOf(i)));
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[__VU % data.tokens.length];
  const params = { headers: { Authorization: `Bearer ${token}` } };

  let cursor = null;

  group('Trang đầu (đọc feed dựng sẵn từ Redis)', () => {
    const res = http.get(
      `${BASE_URL}/feed/following?limit=10`,
      Object.assign({}, params, { tags: { name: 'GET /feed/following' } }),
    );
    firstPage.add(res.timings.duration);

    const ok = check(res, {
      'feed 200': (r) => r.status === 200,
      'feed có dữ liệu': (r) => {
        try {
          const b = r.json();
          return Array.isArray(b?.data?.data ?? b?.data);
        } catch {
          return false;
        }
      },
    });

    if (ok) {
      try {
        const meta = res.json()?.data?.meta;
        if (meta?.has_more && meta?.next_cursor) cursor = meta.next_cursor;
      } catch {
        /* bỏ qua */
      }
    }
  });

  // Cuộn thêm 2 trang — nếu độ trễ tăng vọt theo độ sâu thì phân trang có vấn đề.
  for (let page = 0; page < 2 && cursor; page++) {
    group('Cuộn vô hạn (phân trang theo con trỏ)', () => {
      const res = http.get(
        `${BASE_URL}/feed/following?limit=10&cursor=${cursor}`,
        Object.assign({}, params, {
          tags: { name: 'GET /feed/following (cursor)' },
        }),
      );
      deepPage.add(res.timings.duration);
      check(res, { 'feed cursor 200': (r) => r.status === 200 });

      cursor = null;
      try {
        const meta = res.json()?.data?.meta;
        if (meta?.has_more && meta?.next_cursor) cursor = meta.next_cursor;
      } catch {
        /* hết trang */
      }
    });
  }
}
