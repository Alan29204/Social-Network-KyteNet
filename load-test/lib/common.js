import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/** Seed tạo 1000 user: traveler1..traveler1000@vn.seed, cùng mật khẩu. */
export const TOTAL_SEED_USERS = Number(__ENV.TOTAL_USERS || 1000);
export const SEED_PASSWORD = __ENV.SEED_PASSWORD || 'password123';

/** traveler1 = KOL "vietnam_oi", có đúng 500 follower = CELEBRITY_THRESHOLD. */
export const KOL_EMAIL = 'traveler1@vn.seed';

export function emailOf(i) {
  return `traveler${i}@vn.seed`;
}

/**
 * Đăng nhập, trả về accessToken.
 * Response bị TransformInterceptor bọc: { statusCode, message, data: { accessToken, user } }
 */
export function login(email, password = SEED_PASSWORD) {
  const res = http.post(
    `${BASE_URL}/users/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /users/login' },
    },
  );

  const ok = check(res, {
    'login 2xx': (r) => r.status === 200 || r.status === 201,
  });
  if (!ok) {
    throw new Error(
      `Login thất bại (${email}): status=${res.status} body=${String(res.body).slice(0, 200)}`,
    );
  }

  const body = res.json();
  const token = body?.data?.accessToken ?? body?.accessToken;
  if (!token) {
    throw new Error(`Không tìm thấy accessToken trong response: ${res.body}`);
  }
  return token;
}

/**
 * Đăng nhập N user ở giai đoạn setup() và trả mảng token.
 * JWT của dự án có TTL rất dài nên login 1 lần rồi tái dùng là an toàn.
 */
export function loginMany(count, startIndex = 1) {
  const tokens = [];
  for (let i = startIndex; i < startIndex + count; i++) {
    tokens.push(login(emailOf(i)));
  }
  return tokens;
}

export function authHeaders(token, name) {
  return {
    headers: { Authorization: `Bearer ${token}` },
    tags: name ? { name } : undefined,
  };
}

/** Ngưỡng đạt/không đạt dùng chung — con số này sẽ đi thẳng vào báo cáo. */
export const DEFAULT_THRESHOLDS = {
  http_req_failed: ['rate<0.01'], // <1% request lỗi
  http_req_duration: ['p(95)<500', 'p(99)<1000'], // p95 <500ms, p99 <1s
  checks: ['rate>0.99'],
};
