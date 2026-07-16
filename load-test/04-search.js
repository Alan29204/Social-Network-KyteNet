/**
 * KỊCH BẢN 4 — TÌM KIẾM TIẾNG VIỆT KHÔNG DẤU (đóng góp thứ ba)
 *
 * Cần chứng minh: chỉ mục GIN + pg_trgm thực sự có tác dụng, tức là truy vấn
 * KHÔNG quét tuần tự toàn bảng.
 *
 * ⚠ CẢNH BÁO QUAN TRỌNG TRƯỚC KHI ĐO:
 * search-index.bootstrap.ts tạo extension + chỉ mục GIN lúc khởi động. Nếu user
 * Postgres KHÔNG có quyền CREATE EXTENSION, code chỉ ghi logger.warn rồi ÂM
 * THẦM lùi về `ILIKE` (seq scan). Search vẫn "chạy đúng" nhưng chậm thảm hại.
 * => HÃY XEM LOG KHỞI ĐỘNG BACKEND. Nếu thấy cảnh báo về unaccent/pg_trgm thì
 *    mọi số đo dưới đây là số của seq-scan, KHÔNG phải của chỉ mục GIN.
 *
 * Đo 3 nhóm truy vấn:
 *   - /search        : gõ-để-tìm, chạy SONG SONG searchUsers + searchPosts
 *                      → mỗi lần gõ phím = ~5-6 query Postgres.
 *   - /search/posts  : có phân trang → đo cả deep pagination (OFFSET scan).
 *   - Từ khoá KHÔNG DẤU vs CÓ DẤU: phải cho kết quả tương đương về độ trễ,
 *     nếu không thì f_unaccent đang phá index.
 *
 * Chạy:  k6 run load-test/04-search.js
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

const PEAK_VUS = Number(__ENV.VUS || 50);
const POOL = Number(__ENV.POOL || 50);

const noAccentMs = new Trend('search_khong_dau_ms', true);
const withAccentMs = new Trend('search_co_dau_ms', true);
const deepPageMs = new Trend('search_deep_page_ms', true);

/** Từ khoá bám theo dữ liệu seed (địa danh Việt Nam). */
const KEYWORDS_NO_ACCENT = [
  'ha noi',
  'da nang',
  'sa pa',
  'ha long',
  'hoi an',
  'cat ba',
  'ha giang',
  'nguyen',
];
const KEYWORDS_WITH_ACCENT = [
  'Hà Nội',
  'Đà Nẵng',
  'Sa Pa',
  'Hạ Long',
  'Hội An',
  'Cát Bà',
  'Hà Giang',
  'Nguyễn',
];

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: PEAK_VUS },
        { duration: '2m', target: PEAK_VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: Object.assign({}, DEFAULT_THRESHOLDS, {
    search_khong_dau_ms: ['p(95)<400'],
    search_co_dau_ms: ['p(95)<400'],
    search_deep_page_ms: ['p(95)<600'],
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
  const k = __ITER % KEYWORDS_NO_ACCENT.length;

  group('Không dấu (đường đi unaccent + trigram)', () => {
    const q = encodeURIComponent(KEYWORDS_NO_ACCENT[k]);
    const res = http.get(
      `${BASE_URL}/search?q=${q}`,
      Object.assign({}, params, { tags: { name: 'GET /search (khong dau)' } }),
    );
    noAccentMs.add(res.timings.duration);
    check(res, { 'search khong dau 200': (r) => r.status === 200 });
  });

  group('Có dấu (đối chứng)', () => {
    const q = encodeURIComponent(KEYWORDS_WITH_ACCENT[k]);
    const res = http.get(
      `${BASE_URL}/search?q=${q}`,
      Object.assign({}, params, { tags: { name: 'GET /search (co dau)' } }),
    );
    withAccentMs.add(res.timings.duration);
    check(res, { 'search co dau 200': (r) => r.status === 200 });
  });

  group('Phân trang sâu bài viết (OFFSET scan)', () => {
    const q = encodeURIComponent(KEYWORDS_NO_ACCENT[k]);
    const page = 1 + (__ITER % 5); // trang 1..5
    const res = http.get(
      `${BASE_URL}/search/posts?q=${q}&page=${page}&limit=10`,
      Object.assign({}, params, { tags: { name: 'GET /search/posts' } }),
    );
    deepPageMs.add(res.timings.duration);
    check(res, { 'search posts 200': (r) => r.status === 200 });
  });
}
