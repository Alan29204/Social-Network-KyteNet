/**
 * WARM-UP — BẮT BUỘC chạy trước mọi kịch bản đo.
 *
 * Vì sao: script seed CHỈ ghi vào PostgreSQL, KHÔNG dựng sẵn bảng tin trong
 * Redis. Lần đầu mỗi user gọi /feed/following, hàm ensureFeedPopulated() sẽ
 * thấy ZCARD feed:{uid} < 5 và chạy cold-start (truy vấn DB + pipeline Redis).
 *
 * Nếu bỏ qua bước này, toàn bộ p95/p99 bạn đo được là số của COLD START, không
 * phải năng lực thật của cơ chế fan-out. Đây là lỗi kinh điển khi load test.
 *
 * Chạy:  k6 run load-test/00-warmup.js
 */
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, emailOf, login, TOTAL_SEED_USERS } from './lib/common.js';

const WARM_USERS = Number(__ENV.WARM_USERS || 200);

export const options = {
  scenarios: {
    warmup: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: WARM_USERS,
      maxDuration: '10m',
    },
  },
  // Warm-up không phải phép đo → không đặt ngưỡng đạt/trượt.
  thresholds: {},
};

export default function () {
  const idx = (__ITER % TOTAL_SEED_USERS) + 1;
  const token = login(emailOf(idx));
  const params = { headers: { Authorization: `Bearer ${token}` } };

  // Kích hoạt ensureFeedPopulated() → dựng feed:{uid} trong Redis
  const following = http.get(
    `${BASE_URL}/feed/following?limit=10`,
    Object.assign({}, params, { tags: { name: 'warmup /feed/following' } }),
  );

  // Kích hoạt cache ứng viên toàn cục + hồ sơ sở thích + xếp hạng cá nhân hoá
  const explore = http.get(
    `${BASE_URL}/feed/explore?limit=10`,
    Object.assign({}, params, { tags: { name: 'warmup /feed/explore' } }),
  );

  check(following, { 'warm following ok': (r) => r.status === 200 });
  check(explore, { 'warm explore ok': (r) => r.status === 200 });
}

export function handleSummary(data) {
  const n = data.metrics.iterations?.values?.count ?? 0;
  return {
    stdout: `\n✔ Đã làm nóng bảng tin cho ${n} user. Giờ có thể chạy các kịch bản đo.\n\n`,
  };
}
