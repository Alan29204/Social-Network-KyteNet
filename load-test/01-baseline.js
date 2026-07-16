/**
 * KỊCH BẢN 1 — BASELINE (đường cơ sở)
 *
 * Mục đích: đo chi phí "sàn" của hệ thống TRƯỚC khi chạm vào nghiệp vụ, để khi
 * đo /feed hay /search bạn biết bao nhiêu ms là của framework và bao nhiêu là
 * của thuật toán mình viết. Không có số này thì mọi con số khác đều vô nghĩa.
 *
 * Đo 2 mức:
 *   A. GET /            → NestJS + interceptor, KHÔNG qua JWT, KHÔNG chạm DB.
 *   B. GET /users/account → thêm 1 lượt xác thực JWT. Lưu ý: JwtStrategy truy vấn
 *      Postgres MỖI request (jwt.strategy.ts) → hiệu (B − A) chính là chi phí
 *      xác thực, nó cộng vào TẤT CẢ các endpoint khác.
 *
 * Chạy:  k6 run load-test/01-baseline.js
 */
import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, emailOf, login, DEFAULT_THRESHOLDS } from './lib/common.js';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: Object.assign({}, DEFAULT_THRESHOLDS, {
    'http_req_duration{name:GET /}': ['p(95)<50'],
    'http_req_duration{name:GET /users/account}': ['p(95)<200'],
  }),
};

export function setup() {
  return { token: login(emailOf(2)) };
}

export default function (data) {
  group('A. Không xác thực', () => {
    const res = http.get(`${BASE_URL}/`, { tags: { name: 'GET /' } });
    check(res, { 'root 200': (r) => r.status === 200 });
  });

  group('B. Có xác thực JWT (thêm 1 query DB)', () => {
    const res = http.get(`${BASE_URL}/users/account`, {
      headers: { Authorization: `Bearer ${data.token}` },
      tags: { name: 'GET /users/account' },
    });
    check(res, { 'account 200': (r) => r.status === 200 });
  });
}
