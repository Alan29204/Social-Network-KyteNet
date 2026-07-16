/**
 * KỊCH BẢN 3 — BẢNG TIN KHÁM PHÁ  ★ PHÉP ĐO CHO ĐÓNG GÓP GỢI Ý HEAD/TAIL ★
 *
 * Kịch bản này cố tình chạy DÀI (>5 phút) vì hai lý do kỹ thuật:
 *
 *   1. CACHE STAMPEDE. Nhóm ứng viên toàn cục được cache 300 giây và KHÔNG có
 *      khoá (lock). Đúng thời điểm cache hết hạn giữa lúc tải cao, N request sẽ
 *      CÙNG chạy lại truy vấn tổng hợp nặng (LEFT JOIN reaction + comment,
 *      GROUP BY, ORDER BY biểu thức engagement). Chạy dưới 5 phút sẽ KHÔNG BAO
 *      GIỜ thấy cú spike này → và bạn sẽ báo cáo một con số đẹp nhưng sai.
 *      Hãy nhìn vào p99, không phải p95.
 *
 *   2. LONG-TAIL. Phải cuộn đủ sâu để con trỏ chuyển từ `h:<offset>` (HEAD)
 *      sang `t:<createdAtMs>:<id>` (TAIL). Truy vấn TAIL dùng
 *      `post.id NOT IN (...)` với tới ~1200 tham số bind (200 ranked + 1000
 *      seen) → query plan có thể rất tệ. Script tách riêng độ trễ HEAD và TAIL
 *      để bạn so sánh trực tiếp.
 *
 * Chạy:  k6 run load-test/03-feed-explore.js
 */
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  emailOf,
  login,
  TOTAL_SEED_USERS,
  DEFAULT_THRESHOLDS,
} from './lib/common.js';

const PEAK_VUS = Number(__ENV.VUS || 50);
const POOL = Number(__ENV.POOL || 100);
const DEPTH = Number(__ENV.DEPTH || 6); // số lần "tải thêm" mỗi vòng

const headMs = new Trend('explore_head_ms', true);
const tailMs = new Trend('explore_tail_ms', true);
const reachedTail = new Counter('explore_reached_tail');

export const options = {
  scenarios: {
    sustained: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: PEAK_VUS },
        // Giữ tải 6 phút: đủ dài để cache ứng viên (TTL 300s) hết hạn ÍT NHẤT
        // một lần ngay giữa lúc đang tải → bắt được cú spike stampede.
        { duration: '6m', target: PEAK_VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: Object.assign({}, DEFAULT_THRESHOLDS, {
    // Nới p99 vì stampede là hiện tượng CÓ THẬT cần ghi nhận, không phải giấu đi.
    'http_req_duration{name:GET /feed/explore}': ['p(95)<600'],
    explore_head_ms: ['p(95)<600'],
    explore_tail_ms: ['p(95)<800'],
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

  for (let page = 0; page < DEPTH; page++) {
    // Con trỏ bắt đầu bằng "t:" nghĩa là đã sang vùng TAIL (long-tail).
    const isTail = typeof cursor === 'string' && cursor.startsWith('t:');
    const url = cursor
      ? `${BASE_URL}/feed/explore?limit=10&cursor=${encodeURIComponent(cursor)}`
      : `${BASE_URL}/feed/explore?limit=10`;

    const res = http.get(
      url,
      Object.assign({}, params, { tags: { name: 'GET /feed/explore' } }),
    );

    if (isTail) {
      tailMs.add(res.timings.duration);
      if (page === 0 || !cursor) reachedTail.add(1);
    } else {
      headMs.add(res.timings.duration);
    }

    check(res, { 'explore 200': (r) => r.status === 200 });

    cursor = null;
    try {
      const meta = res.json()?.data?.meta;
      if (meta?.has_more && meta?.next_cursor) {
        cursor = meta.next_cursor;
        if (String(cursor).startsWith('t:')) reachedTail.add(1);
      }
    } catch {
      /* hết trang */
    }
    if (!cursor) break;
  }
}
