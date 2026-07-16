/**
 * KỊCH BẢN 5 — NHẮN TIN THỜI GIAN THỰC (WebSocket / Socket.IO)
 *
 * ★ ĐÂY LÀ NƠI HỆ THỐNG NHIỀU KHẢ NĂNG SẬP ĐẦU TIÊN ★
 *
 * Lý do (đã đọc trong gategate.gateway.ts):
 *   handleConnection() và handleDisconnect() gọi `this.server.emit('userStatusChanged')`
 *   — tức là BROADCAST CHO TOÀN BỘ socket đang kết nối, mỗi khi CÓ MỘT user
 *   vào/ra. Với N socket đồng thời, một đợt ramp-up N user sẽ sinh ra N × N
 *   message. Ở N = 1000 → 1.000.000 message chỉ để báo "ai đó vừa online".
 *   Đây là độ phức tạp O(n²) và là phát hiện đáng giá để viết vào báo cáo.
 *
 * Ngoài ra mỗi tin nhắn text tốn ≥4 query DB (kiểm tra member, phòng, chặn) và
 * gateway còn console.log toàn bộ body mỗi tin → I/O đồng bộ làm méo số đo.
 *
 * Cách đo: tăng dần 100 → 300 → 600 socket, quan sát:
 *   - ws_connect_ms          : thời gian bắt tay có tăng vọt không
 *   - ws_msgs_received       : tổng message nhận được (sẽ phình theo n²)
 *   - ws_echo_latency_ms     : gửi sendMessage → nhận messageSaved mất bao lâu
 *
 * Chạy:  k6 run load-test/05-chat-ws.js
 *        k6 run -e VUS=600 load-test/05-chat-ws.js
 *
 * Ghi chú kỹ thuật: k6 không nói được giao thức Socket.IO nên script tự bắt tay
 * Engine.IO v4 bằng WebSocket thô:
 *   server "0{...}" (open) → client "40" (connect ns) → server "40{sid}"
 *   sự kiện: "42[\"tên\",payload]"   ·   ping "2" → pong "3"
 */
import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, emailOf, login, TOTAL_SEED_USERS } from './lib/common.js';

const PEAK_VUS = Number(__ENV.VUS || 300);
const HOLD = __ENV.HOLD || '2m';
const MSGS_PER_VU = Number(__ENV.MSGS || 5);

const WS_URL =
  (BASE_URL.startsWith('https') ? 'wss' : 'ws') +
  BASE_URL.replace(/^https?/, '') +
  '/socket.io/?EIO=4&transport=websocket';

const connectMs = new Trend('ws_connect_ms', true);
const echoMs = new Trend('ws_echo_latency_ms', true);
const received = new Counter('ws_msgs_received');
const statusBroadcasts = new Counter('ws_userStatusChanged_received');
const errors = new Counter('ws_errors');

export const options = {
  scenarios: {
    ramp_sockets: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.round(PEAK_VUS / 3) },
        { duration: '30s', target: Math.round((PEAK_VUS * 2) / 3) },
        { duration: '30s', target: PEAK_VUS },
        { duration: HOLD, target: PEAK_VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    ws_connect_ms: ['p(95)<2000'],
    ws_echo_latency_ms: ['p(95)<1000'],
    ws_errors: ['count<10'],
  },
};

export function setup() {
  const POOL = Math.min(PEAK_VUS, 300);
  const tokens = [];
  for (let i = 2; i < 2 + POOL && i <= TOTAL_SEED_USERS; i++) {
    tokens.push(login(emailOf(i)));
  }

  // Tạo sẵn 1 phòng chat 1-1 giữa user #2 và user #3 để có chỗ gửi tin nhắn.
  const meRes = http.get(`${BASE_URL}/users/account`, {
    headers: { Authorization: `Bearer ${tokens[1]}` },
  });
  const targetId = meRes.json()?.data?.id ?? meRes.json()?.id;

  const roomRes = http.post(
    `${BASE_URL}/chat-rooms/direct/${targetId}`,
    null,
    { headers: { Authorization: `Bearer ${tokens[0]}` } },
  );
  const roomId = roomRes.json()?.data?.id ?? roomRes.json()?.id;

  if (!roomId) {
    throw new Error(
      `Không tạo được phòng chat để test: ${roomRes.status} ${String(roomRes.body).slice(0, 200)}`,
    );
  }
  console.log(`Phòng chat dùng để test: ${roomId}`);

  return { tokens, roomId };
}

export default function (data) {
  const token = data.tokens[__VU % data.tokens.length];
  const started = Date.now();

  // ws-auth.middleware chấp nhận header Authorization ở lúc bắt tay → đơn giản
  // hơn nhiều so với nhồi token vào gói CONNECT của Socket.IO.
  const params = { headers: { Authorization: `Bearer ${token}` } };

  const res = ws.connect(WS_URL, params, function (socket) {
    let connectedAt = 0;
    let sent = 0;
    const pending = {}; // tempId -> thời điểm gửi

    socket.on('open', () => {
      connectMs.add(Date.now() - started);
    });

    socket.on('message', (raw) => {
      received.add(1);
      const msg = String(raw);

      // "0{...}" — Engine.IO OPEN → trả lời bằng "40" để vào namespace mặc định
      if (msg.startsWith('0{')) {
        socket.send('40');
        return;
      }

      // "40{...}" — Socket.IO CONNECT thành công
      if (msg.startsWith('40')) {
        connectedAt = Date.now();
        return;
      }

      // "2" — server ping → phải trả "3" (pong), nếu không sẽ bị ngắt kết nối
      if (msg === '2') {
        socket.send('3');
        return;
      }

      // "42[...]" — sự kiện nghiệp vụ
      if (msg.startsWith('42')) {
        let evt;
        try {
          evt = JSON.parse(msg.slice(2));
        } catch {
          return;
        }
        const [name, payload] = evt;

        // Đây chính là cơn bão O(n²) cần đo
        if (name === 'userStatusChanged') {
          statusBroadcasts.add(1);
          return;
        }

        if (name === 'messageSaved') {
          const t0 = pending[payload?.tempId];
          if (t0) {
            echoMs.add(Date.now() - t0);
            delete pending[payload.tempId];
          }
          return;
        }

        if (name === 'messageError') {
          errors.add(1);
        }
      }
    });

    // Gửi tin nhắn định kỳ, chỉ khi đã CONNECT xong
    socket.setInterval(() => {
      if (!connectedAt || sent >= MSGS_PER_VU) return;

      const tempId = `k6-${__VU}-${sent}-${Date.now()}`;
      pending[tempId] = Date.now();
      sent++;

      socket.send(
        '42' +
          JSON.stringify([
            'sendMessage',
            {
              chat_room_id: data.roomId,
              message: `[k6] tin nhắn tải thử ${sent} từ VU ${__VU}`,
              tempId,
            },
          ]),
      );
    }, 3000);

    // Heartbeat 30s giống hệt client thật
    socket.setInterval(() => {
      if (connectedAt) socket.send('42' + JSON.stringify(['heartbeat', {}]));
    }, 30000);

    socket.on('error', (e) => {
      errors.add(1);
      console.error(`Lỗi WS (VU ${__VU}): ${e?.error?.() ?? e}`);
    });

    // Giữ kết nối mở — đây là mục đích chính: xem hệ thống chịu được bao nhiêu
    // socket đồng thời.
    socket.setTimeout(() => socket.close(), 60000);
  });

  check(res, { 'ws bắt tay 101': (r) => r && r.status === 101 });
  sleep(1);
}
