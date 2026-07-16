# Hướng dẫn kiểm thử hiệu năng và chịu tải cho KyteNet

Tài liệu này viết cho người chưa từng làm kiểm thử hiệu năng bao giờ. Mọi thuật
ngữ đều được giải thích ngay khi xuất hiện lần đầu.

Mục tiêu cuối cùng: bạn có được những con số thật để thay thế câu
*"Quy mô dữ liệu và người dùng thử nghiệm còn nhỏ, chưa đánh giá được khả năng
chịu tải thực tế"* mà bạn đang phải viết trong phần Hạn chế của báo cáo.

---

# PHẦN 1. NHỮNG KHÁI NIỆM CƠ BẢN

Hãy đọc kỹ phần này. Nếu không hiểu các khái niệm ở đây, bạn sẽ không đọc được
kết quả đo, và tệ hơn là có thể báo cáo sai số liệu.

## 1.1. Kiểm thử hiệu năng và kiểm thử chịu tải là gì

**Kiểm thử hiệu năng** (performance testing) là việc đo xem hệ thống phản hồi
nhanh hay chậm khi có người dùng truy cập.

**Kiểm thử chịu tải** (load testing) là việc giả lập rất nhiều người dùng truy
cập cùng một lúc, để xem hệ thống chịu được bao nhiêu người trước khi bắt đầu
chậm đi hoặc báo lỗi.

Cách làm: chúng ta dùng một chương trình để tự động gửi hàng nghìn yêu cầu
(request) đến máy chủ, giống như có hàng nghìn người thật đang dùng ứng dụng.
Chương trình đó sẽ đo lại thời gian máy chủ trả lời và thống kê thành các con số.

## 1.2. Công cụ k6

**k6** là công cụ chúng ta dùng để tạo ra tải giả lập. Máy của bạn đã cài sẵn k6
phiên bản 2.1.0 rồi, không cần cài thêm gì nữa. Bạn có thể kiểm tra bằng lệnh:

```bash
k6 version
```

k6 hoạt động như sau: bạn viết một file JavaScript mô tả "một người dùng ảo sẽ
làm gì" (ví dụ: đăng nhập, rồi mở bảng tin, rồi cuộn thêm hai trang). Sau đó k6
sẽ nhân bản kịch bản đó lên thành hàng trăm người dùng ảo chạy song song.

## 1.3. VU nghĩa là gì

**VU** là viết tắt của **Virtual User**, tiếng Việt là **người dùng ảo**.

Một VU tương ứng với một người dùng giả lập. Nếu bạn chạy với 100 VU, nghĩa là
k6 giả lập 100 người đang dùng ứng dụng cùng lúc. Mỗi VU sẽ lặp đi lặp lại kịch
bản bạn viết cho tới khi hết thời gian.

Lưu ý: 100 VU không có nghĩa là 100 request. Mỗi VU có thể gửi rất nhiều request
trong suốt bài đo.

## 1.4. RPS nghĩa là gì

**RPS** là viết tắt của **Requests Per Second**, tiếng Việt là **số yêu cầu mỗi
giây**. Đây là con số thể hiện thông lượng (throughput) của hệ thống.

Ví dụ: nếu hệ thống xử lý được 150 RPS, nghĩa là mỗi giây nó phục vụ xong 150
lượt gọi API.

Đây là con số quan trọng nhất để trả lời câu hỏi "hệ thống của em chịu được bao
nhiêu?".

## 1.5. Độ trễ, và tại sao phải dùng p95 và p99

**Độ trễ** (latency) là khoảng thời gian từ lúc gửi yêu cầu đến lúc nhận được câu
trả lời, tính bằng mili giây (viết tắt là ms, một phần nghìn giây).

Vấn đề: nếu chỉ lấy **giá trị trung bình** thì rất dễ bị đánh lừa. Giả sử có 100
lượt truy cập, trong đó 99 lượt nhanh 10ms nhưng 1 lượt chậm 5000ms. Trung bình
sẽ là khoảng 60ms, nghe rất đẹp, nhưng thực tế có một người dùng đã phải chờ 5
giây.

Vì vậy người ta dùng **phân vị** (percentile):

- **p50** (còn gọi là trung vị): 50 phần trăm số lượt truy cập nhanh hơn con số
  này. Đây là trải nghiệm của người dùng điển hình.
- **p95**: 95 phần trăm số lượt truy cập nhanh hơn con số này. Nói cách khác,
  chỉ 5 phần trăm chậm hơn. Đây là con số hay dùng nhất để đánh giá chất lượng.
- **p99**: 99 phần trăm số lượt truy cập nhanh hơn con số này. Đây là trải nghiệm
  của nhóm xui xẻo nhất. Con số này rất quan trọng vì nó bộc lộ những sự cố hiếm
  nhưng nghiêm trọng.

Ví dụ cách đọc: "p95 bằng 300ms" nghĩa là 95 phần trăm người dùng nhận được câu
trả lời trong vòng 300 mili giây trở xuống.

## 1.6. Cold start (khởi động nguội) nghĩa là gì

**Cold start** nghĩa là lần chạy đầu tiên, khi bộ nhớ đệm (cache) còn trống rỗng
nên hệ thống phải làm rất nhiều việc để dựng dữ liệu lên.

Trong KyteNet, bảng tin của mỗi người được lưu sẵn trong Redis. Nhưng lần đầu
tiên một người dùng mở bảng tin, nếu Redis chưa có gì, hệ thống phải truy vấn
PostgreSQL để dựng lại bảng tin đó. Lần đó sẽ chậm hơn nhiều lần so với những lần
sau.

Nếu bạn đo ngay lần đầu, bạn sẽ đo nhầm tốc độ của cold start chứ không phải tốc
độ thật của cơ chế fan-out. Đây là lý do bắt buộc phải chạy bước làm nóng
(warm-up) trước.

## 1.7. Cache và cache stampede

**Cache** (bộ nhớ đệm) là nơi lưu tạm kết quả đã tính, để lần sau không phải tính
lại. Mỗi cache có một thời hạn sống, gọi là **TTL** (Time To Live, tức thời gian
tồn tại).

**Cache stampede** (tiếng Việt tạm dịch là "giẫm đạp khi cache hết hạn") là hiện
tượng sau: giả sử một kết quả được cache trong 5 phút. Đúng giây phút cache hết
hạn, nếu lúc đó đang có 200 người cùng truy cập, thì cả 200 người đều thấy cache
trống và cả 200 sẽ cùng lúc chạy lại phép tính nặng đó. Máy chủ bị dồn 200 phép
tính nặng cùng lúc và tắc nghẽn.

KyteNet có nguy cơ này ở bảng tin Khám phá, vì nhóm ứng viên toàn cục được cache
300 giây mà không có cơ chế khoá (lock). Đây là lý do bài đo bảng tin Khám phá
phải chạy dài hơn 5 phút, nếu không bạn sẽ không bao giờ nhìn thấy hiện tượng
này.

## 1.8. OOM nghĩa là gì

**OOM** là viết tắt của **Out Of Memory**, tiếng Việt là **hết bộ nhớ**.

Redis được cấu hình giới hạn chỉ dùng tối đa 200 megabyte bộ nhớ. Khi dữ liệu
vượt quá 200 megabyte, Redis sẽ hết bộ nhớ.

Lúc đó Redis xử lý thế nào phụ thuộc vào chính sách được đặt. Chính sách hiện tại
của dự án là **noeviction**, nghĩa là "không xoá bớt dữ liệu cũ". Với chính sách
này, khi hết bộ nhớ Redis sẽ **từ chối mọi lệnh ghi và trả về lỗi**.

Hậu quả: backend gọi Redis để ghi bảng tin, Redis báo lỗi, backend trả về lỗi 500
cho người dùng. Bạn sẽ thấy hàng loạt lỗi 500 và tưởng rằng hệ thống không chịu
nổi tải, trong khi thực ra chỉ là Redis hết chỗ chứa.

## 1.9. Rate limit (giới hạn tần suất truy cập)

**Rate limit** là cơ chế giới hạn số lượng yêu cầu mà một người dùng được phép
gửi trong một khoảng thời gian. Mục đích là chống lạm dụng, chống tấn công.

KyteNet có bật cơ chế này (thư viện Throttler của NestJS). Vấn đề là khi bạn chạy
kiểm thử tải, chính công cụ k6 của bạn sẽ bị hệ thống coi là kẻ lạm dụng và bị
chặn.

Khi bị chặn, máy chủ trả về mã lỗi **HTTP 429**, có nghĩa là "Too Many Requests"
(quá nhiều yêu cầu). Bạn sẽ thấy tỷ lệ lỗi vọt lên cao và tưởng hệ thống yếu,
trong khi thực ra bạn chỉ đang đo chính bộ giới hạn tần suất chứ không đo năng
lực xử lý.

## 1.10. N+1 query

**N+1 query** là một lỗi hiệu năng kinh điển. Nó xảy ra khi thay vì gửi một câu
truy vấn duy nhất để lấy N bản ghi, chương trình lại gửi 1 câu truy vấn để lấy
danh sách, rồi lặp qua từng phần tử và gửi thêm N câu truy vấn nữa. Tổng cộng là
N cộng 1 câu truy vấn, nên gọi là N+1.

Mỗi câu truy vấn đều tốn thời gian đi và về qua mạng. Nếu N bằng 15 thì bạn tốn
gấp 15 lần thời gian so với việc gộp lại làm một.

## 1.11. Seq Scan và Index Scan

Khi PostgreSQL tìm dữ liệu, nó có hai cách:

- **Seq Scan** (Sequential Scan, quét tuần tự): đọc lần lượt từng dòng trong
  bảng từ đầu đến cuối để tìm dòng khớp. Nếu bảng có 100 nghìn dòng thì phải đọc
  cả 100 nghìn dòng. Rất chậm.
- **Index Scan** (quét theo chỉ mục): dùng chỉ mục (index) giống như tra mục lục
  sách, nhảy thẳng đến chỗ cần tìm. Rất nhanh.

Dự án của bạn tạo chỉ mục loại **GIN** kết hợp **pg_trgm** để tìm kiếm tiếng Việt
không dấu. Nhưng nếu tài khoản PostgreSQL không đủ quyền tạo extension, code sẽ
chỉ ghi một dòng cảnh báo rồi lặng lẽ chuyển sang quét tuần tự. Chức năng tìm
kiếm vẫn cho kết quả đúng nên bạn không hề biết, chỉ là nó chậm hơn rất nhiều.

---

# PHẦN 2. BA VIỆC BẮT BUỘC PHẢI LÀM TRƯỚC KHI ĐO

Nếu bỏ qua ba việc này, mọi con số bạn đo được đều sai và không dùng được cho báo
cáo. Hãy làm đủ cả ba.

## Việc 1. Nới giới hạn tần suất truy cập

**Vấn đề đang có.** Mở file `core-api/.env`, bạn sẽ thấy hai dòng:

```
THROTTLE_TTL=60000
THROTTLE_LIMIT=10000
```

Hai dòng này có nghĩa là: trong cửa sổ 60000 mili giây (tức 60 giây), mỗi địa chỉ
IP chỉ được gửi tối đa 10000 yêu cầu. Chia ra là khoảng 166 yêu cầu mỗi giây.

Điều quan trọng bạn cần hiểu: k6 chạy trên chính máy tính của bạn, nên **tất cả
người dùng ảo đều dùng chung một địa chỉ IP**. Dù bạn tạo 500 người dùng ảo, hệ
thống vẫn chỉ thấy một địa chỉ IP duy nhất. Nghĩa là cả 500 người ảo phải chia
nhau cái trần 166 yêu cầu mỗi giây đó.

Kết quả: bạn sẽ không bao giờ đo được quá 166 RPS, và sẽ thấy rất nhiều lỗi HTTP
429. Bạn sẽ kết luận sai rằng hệ thống chỉ chịu được 166 RPS, trong khi thực ra
đó là con số bạn tự đặt trong file cấu hình.

Ngoài ra còn một file `.env` khác nằm ở thư mục gốc của dự án, trong đó
`THROTTLE_LIMIT=100`, tức chỉ khoảng 1,6 yêu cầu mỗi giây. File này dùng cho
docker-compose. Nếu bạn chạy backend qua Docker thì tình hình còn tệ hơn nữa.

**Cách xử lý.** Trước khi đo, sửa file `core-api/.env` thành:

```
THROTTLE_TTL=60000
THROTTLE_LIMIT=100000000
```

Sau đó khởi động lại backend để cấu hình mới có hiệu lực.

**Rất quan trọng:** sau khi đo xong hãy trả lại giá trị cũ, đừng để giá trị này
trong bản nộp. Và trong báo cáo hãy ghi trung thực một câu như sau:

> "Trong quá trình kiểm thử tải, cơ chế giới hạn tần suất truy cập được nới lỏng
> tạm thời. Mục đích là đo năng lực xử lý của hệ thống, thay vì đo chính bộ giới
> hạn tần suất."

Đây là cách làm chuẩn mực trong ngành, hoàn toàn không có gì phải giấu.

## Việc 2. Nâng giới hạn bộ nhớ của Redis

**Vấn đề đang có.** Mở file `docker-compose.yml`, tìm đến dòng cấu hình Redis:

```
command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 200mb --maxmemory-policy noeviction
```

Redis chỉ được dùng tối đa 200 megabyte, và khi hết thì từ chối ghi (đọc lại phần
1.8 về OOM nếu bạn quên).

Trong khi đó Redis của KyteNet phải chứa rất nhiều thứ cùng lúc:

- Bảng tin dựng sẵn của từng người dùng, mỗi bảng tin chứa tối đa 500 bài.
- Danh sách xếp hạng bảng tin Khám phá cho từng người dùng.
- Danh sách bài đã xem của từng người dùng, tối đa 1000 bài.
- Hồ sơ sở thích theo hashtag của từng người dùng.
- Bộ nhớ đệm quan hệ theo dõi và quan hệ chặn.
- Và toàn bộ hàng đợi BullMQ cũng nằm chung trong Redis này.

Với 1000 người dùng trong dữ liệu mẫu cộng với tải đồng thời, con số 200 megabyte
rất dễ bị chạm trần.

**Cách xử lý.** Sửa dòng đó thành `--maxmemory 1gb`, rồi khởi động lại Redis:

```bash
docker compose up -d redis_datn
```

Trong lúc chạy bài đo, hãy mở một cửa sổ terminal riêng và theo dõi bộ nhớ Redis
bằng lệnh sau (thay `<mật_khẩu>` bằng mật khẩu Redis trong file .env của bạn):

```bash
docker exec redis_datn redis-cli -a <mật_khẩu> INFO memory
```

Tìm dòng `used_memory_human`. Nếu con số này tiến gần đến 1 gigabyte, hãy dừng
bài đo lại và nâng thêm.

## Việc 3. Làm nóng bảng tin trước khi đo

**Vấn đề đang có.** Script tạo dữ liệu mẫu (`core-api/src/seed.ts`) chỉ ghi dữ
liệu vào PostgreSQL. Nó **không** dựng sẵn bảng tin trong Redis.

Nghĩa là ngay sau khi chạy seed, Redis hoàn toàn trống rỗng về mặt bảng tin. Lần
đầu tiên mỗi người dùng gọi API bảng tin, hệ thống sẽ phát hiện Redis trống và
phải chạy cold start: truy vấn PostgreSQL để lấy bài viết của những người mà họ
theo dõi, rồi ghi ngược lại vào Redis.

Nếu bạn đo ngay lúc đó, bạn đang đo tốc độ của cold start chứ không phải tốc độ
của cơ chế fan-out. Con số sẽ xấu hơn thực tế rất nhiều, và bạn sẽ báo cáo sai.

**Cách xử lý.** Luôn chạy script làm nóng trước tiên:

```bash
k6 run load-test/00-warmup.js
```

Script này sẽ đăng nhập lần lượt 200 người dùng và gọi API bảng tin một lần cho
mỗi người, để buộc hệ thống dựng sẵn bảng tin trong Redis. Sau bước này, các bài
đo tiếp theo mới cho số liệu đúng.

---

# PHẦN 3. CHUẨN BỊ MÔI TRƯỜNG

Làm tuần tự từng bước.

## Bước 1. Khởi động hạ tầng

```bash
cd c:/Users/Dell/Desktop/DATN/social-network-cnet
docker compose up -d
```

Lệnh này khởi động ba dịch vụ:

- PostgreSQL (cơ sở dữ liệu), cổng 5433
- Redis (bộ nhớ đệm và hàng đợi), cổng 6379
- SeaweedFS (lưu trữ ảnh và video), cổng 8333

Kiểm tra cả ba đã chạy chưa:

```bash
docker ps
```

Bạn phải thấy đủ ba container: `postgres_datn`, `redis_datn`, `seaweedfs_datn`.

## Bước 2. Tạo dữ liệu mẫu

**Cảnh báo quan trọng:** lệnh dưới đây sẽ **xoá sạch toàn bộ dữ liệu hiện có**
trong cơ sở dữ liệu (script seed có lệnh TRUNCATE tất cả các bảng). Nếu bạn có dữ
liệu quan trọng đang dùng để demo, hãy sao lưu trước.

```bash
cd core-api
npm run seed
```

Script này sẽ tạo:

- 1000 tài khoản người dùng, email từ `traveler1@vn.seed` đến
  `traveler1000@vn.seed`, tất cả dùng chung một mật khẩu là `password123`.
- Khoảng 2400 bài viết về các địa danh Việt Nam, có kèm ảnh thật đã upload lên
  SeaweedFS, trải đều trong 120 ngày.
- Các quan hệ theo dõi: mỗi người theo dõi ngẫu nhiên từ 5 đến 15 người khác.
- **Một tài khoản đặc biệt rất quan trọng:** `traveler1@vn.seed` có tên người
  dùng là `vietnam_oi`, và có **đúng 500 người theo dõi**.

Vì sao tài khoản đó quan trọng: trong code của bạn, hằng số
`CELEBRITY_THRESHOLD` bằng 500. Nghĩa là tài khoản này rơi đúng vào nhánh
"celebrity", tức nhánh fan-out on read (không đẩy bài, chờ người đọc mới trộn
vào). Nhờ vậy bạn có thể đo được cả hai nhánh của cơ chế fan-out lai, đây chính
là bằng chứng thuyết phục nhất cho đóng góp thứ nhất của đồ án.

Chạy seed mất khá lâu (vài phút) vì phải upload ảnh.

## Bước 3. Chạy backend ở chế độ production

**Không dùng `npm run start:dev`.** Chế độ dev chạy qua ts-node và có bộ theo dõi
thay đổi file (watcher), cả hai đều làm chậm và làm sai lệch số đo.

Hãy chạy bản đã biên dịch:

```bash
cd core-api
npm run build
npm run start:prod
```

Backend sẽ chạy ở địa chỉ `http://localhost:3000`.

**Trong lúc backend khởi động, hãy đọc kỹ dòng log.** Nếu bạn thấy bất kỳ cảnh
báo nào liên quan đến `unaccent`, `pg_trgm` hay `CREATE EXTENSION`, nghĩa là chỉ
mục GIN đã không được tạo, và chức năng tìm kiếm đang chạy ở chế độ quét tuần tự
(đọc lại phần 1.11). Trong trường hợp đó, mọi số đo về tìm kiếm sẽ không phản ánh
đúng giải pháp bạn viết trong báo cáo.

---

# PHẦN 4. CHẠY CÁC BÀI ĐO

Chạy tuần tự từ nhẹ đến nặng. Mở terminal ở thư mục gốc dự án.

## Bài 0. Làm nóng bảng tin (bắt buộc, không phải phép đo)

```bash
k6 run load-test/00-warmup.js
```

Bài này không đo gì cả, chỉ để dựng sẵn bảng tin trong Redis cho 200 người dùng
đầu tiên. Chạy khoảng 1 đến 2 phút. Bạn chỉ cần chạy nó **một lần** sau mỗi lần
chạy lại seed.

## Bài 1. Đo đường cơ sở

```bash
k6 run load-test/01-baseline.js
```

**Bài này đo cái gì.** Nó gọi hai API đơn giản nhất:

- `GET /` là API kiểm tra sức khoẻ, không cần đăng nhập, không chạm cơ sở dữ
  liệu. Thời gian trả về của nó chính là chi phí tối thiểu của framework NestJS.
- `GET /users/account` cần đăng nhập. Điểm đáng chú ý: mỗi lần xác thực token,
  code trong `jwt.strategy.ts` đều gửi một câu truy vấn xuống PostgreSQL để lấy
  vai trò người dùng. Nghĩa là chi phí này cộng vào **mọi** API khác của hệ thống.

**Vì sao phải đo cái này trước.** Giả sử bài đo bảng tin cho ra p95 bằng 300ms.
Con số đó có tốt không? Bạn không thể trả lời nếu không biết rằng chỉ riêng
framework và xác thực đã tốn 50ms. Đường cơ sở giúp bạn tách bạch: bao nhiêu là
chi phí nền tảng, bao nhiêu là chi phí của thuật toán bạn tự viết.

## Bài 2. Đo bảng tin theo dõi (đóng góp fan-out lai)

```bash
k6 run load-test/02-feed-following.js
```

Đây là bài đo **quan trọng nhất** cho đồ án của bạn.

**Bài này đo cái gì.** Nó tăng tải theo bậc thang: 25 người dùng ảo, rồi 50, rồi
100. Ở mỗi bậc nó giữ tải ổn định một khoảng thời gian rồi mới tăng tiếp. Mỗi
người dùng ảo sẽ mở bảng tin rồi cuộn thêm hai trang.

**Cách đọc kết quả, và đây là điều bạn cần hiểu rõ nhất.** Trong báo cáo bạn viết
rằng đọc bảng tin dựng sẵn trong Redis có độ phức tạp O(log n + k), tức là gần
như không phụ thuộc vào số lượng dữ liệu. Bài đo này là cách chứng minh điều đó
bằng số.

Nếu p95 gần như **không đổi** khi bạn tăng từ 25 lên 50 rồi lên 100 người dùng
ảo, thì bạn đã chứng minh được rằng cơ chế bảng tin dựng sẵn thực sự có tác dụng.
Đó là bằng chứng thuyết phục.

Ngược lại, nếu p95 tăng vọt theo số người dùng ảo, nghĩa là có một nút thắt cổ
chai nào đó (rất có thể là số kết nối cơ sở dữ liệu, xem phần 6).

Muốn đẩy tải cao hơn để tìm điểm gãy:

```bash
k6 run -e VUS=200 load-test/02-feed-following.js
```

## Bài 3. Đo bảng tin khám phá (đóng góp gợi ý HEAD và TAIL)

```bash
k6 run load-test/03-feed-explore.js
```

**Bài này chạy 6 phút, và đó là cố ý.** Đừng rút ngắn.

**Lý do phải chạy dài.** Nhóm ứng viên toàn cục của bảng tin Khám phá được cache
trong 300 giây, tức 5 phút, và không có cơ chế khoá. Nếu bạn chỉ chạy 2 phút,
cache sẽ không bao giờ hết hạn trong lúc đang có tải, và bạn sẽ thấy một kết quả
rất đẹp nhưng sai sự thật.

Chạy đủ hơn 5 phút, bạn sẽ bắt được đúng khoảnh khắc cache hết hạn giữa lúc đang
tải cao. Lúc đó nhiều yêu cầu cùng lúc phải chạy lại phép tính tổng hợp nặng (nối
bảng reaction và comment, gom nhóm, sắp xếp theo điểm tương tác). Đây chính là
cache stampede đã giải thích ở phần 1.7.

**Cách đọc kết quả.** Hãy nhìn vào **p99**, không phải p95. Cú giẫm đạp này chỉ
ảnh hưởng đến một số ít yêu cầu nên p95 có thể vẫn đẹp, nhưng p99 sẽ vọt lên rất
cao. Nếu bạn quan sát được hiện tượng này và giải thích được nguyên nhân trong
báo cáo, đó là một điểm cộng lớn về khả năng phân tích.

Bài này cũng tách riêng hai con số: `explore_head_ms` (thời gian của phần HEAD,
tức nhóm bài xếp hạng cá nhân hoá) và `explore_tail_ms` (thời gian của phần TAIL,
tức phần long-tail bạn mới bổ sung). So sánh hai con số này để biết phần TAIL có
đắt hơn HEAD nhiều không.

## Bài 4. Đo tìm kiếm tiếng Việt không dấu

```bash
k6 run load-test/04-search.js
```

**Bài này đo cái gì.** Nó tìm cùng một nội dung theo ba cách:

- Gõ **không dấu**, ví dụ "ha noi". Đây là đường đi qua hàm khử dấu và so khớp
  trigram.
- Gõ **có dấu**, ví dụ "Hà Nội". Đây là đối chứng.
- **Phân trang sâu**, tức xem trang thứ 5 của kết quả. Cách này dùng OFFSET nên
  thường chậm dần khi số trang tăng.

**Cách đọc kết quả.** Nếu độ trễ của truy vấn không dấu và có dấu tương đương
nhau, nghĩa là chỉ mục GIN đang hoạt động tốt cho cả hai. Nếu truy vấn không dấu
chậm hơn hẳn, nghĩa là hàm khử dấu đang phá vỡ chỉ mục.

## Bài 5. Đo nhắn tin thời gian thực qua WebSocket

```bash
k6 run load-test/05-chat-ws.js
```

**Đây nhiều khả năng là nơi hệ thống sập đầu tiên.** Tôi sẽ giải thích vì sao.

Trong file `gategate.gateway.ts`, mỗi khi có **một** người dùng kết nối hoặc ngắt
kết nối, code gọi `this.server.emit('userStatusChanged', ...)`. Lệnh `server.emit`
có nghĩa là **phát cho toàn bộ socket đang kết nối**, không phải chỉ phát cho bạn
bè của người đó.

Hãy tính thử. Nếu có 1000 người dùng lần lượt kết nối:

- Người thứ 1 kết nối: phát cho 1 socket.
- Người thứ 2 kết nối: phát cho 2 socket.
- ...
- Người thứ 1000 kết nối: phát cho 1000 socket.

Tổng cộng khoảng 500 nghìn tin nhắn, chỉ để thông báo "có ai đó vừa online". Nếu
tính cả lúc ngắt kết nối thì lên tới khoảng một triệu. Độ phức tạp này là O(n²),
đọc là "bình phương n", nghĩa là số công việc tăng theo bình phương số người dùng.

Bài đo này tăng dần số socket và đếm riêng số tin `userStatusChanged` nhận được
(chỉ số `ws_userStatusChanged_received`). Nếu con số này phình lên theo bình
phương số VU, bạn đã chứng minh được vấn đề bằng số liệu thật.

Đây là một phát hiện rất đáng giá để đưa vào báo cáo, kèm hướng khắc phục: chỉ
nên phát tín hiệu online cho những người có quan hệ theo dõi hai chiều, thay vì
phát cho toàn bộ hệ thống.

Muốn đẩy lên 600 socket:

```bash
k6 run -e VUS=600 load-test/05-chat-ws.js
```

---

# PHẦN 5. CÁCH ĐỌC KẾT QUẢ CỦA k6

Sau khi chạy xong, k6 in ra một bảng tổng kết. Dưới đây là những dòng bạn cần
quan tâm và cách hiểu chúng.

```
     http_req_duration..............: avg=120ms min=15ms med=95ms max=2.1s p(90)=210ms p(95)=280ms
     http_req_failed................: 0.42%  ✓ 12    ✗ 2847
     http_reqs......................: 2859   142.95/s
     vus............................: 100    min=0   max=100
     iterations.....................: 953    47.65/s
```

Giải thích từng dòng:

- **http_req_duration** là độ trễ của các yêu cầu HTTP.
  - `avg` là trung bình. **Đừng dùng con số này để báo cáo**, lý do đã giải thích
    ở phần 1.5.
  - `med` là trung vị, tức p50.
  - `p(95)` là phân vị 95. **Đây là con số chính bạn đưa vào báo cáo.**
  - `max` là lượt chậm nhất. Nếu max lớn bất thường, hãy tìm nguyên nhân.

- **http_req_failed** là tỷ lệ yêu cầu thất bại. Ở ví dụ trên là 0,42 phần trăm,
  chấp nhận được. **Nếu con số này cao, đừng vội kết luận hệ thống yếu.** Hãy
  kiểm tra xem lỗi là mã gì:
  - Lỗi **429** nghĩa là bị rate limit chặn. Bạn chưa làm Việc 1 ở Phần 2.
  - Lỗi **500** rất có thể là Redis hết bộ nhớ. Bạn chưa làm Việc 2 ở Phần 2.
  - Lỗi **401** nghĩa là token hết hạn hoặc sai.

- **http_reqs** là tổng số yêu cầu và **thông lượng**. Con số `142.95/s` chính là
  RPS. Đây là câu trả lời cho "hệ thống chịu được bao nhiêu".

- **vus** là số người dùng ảo đang chạy tại thời điểm đó.

- **iterations** là số vòng lặp kịch bản đã hoàn thành.

Ngoài ra bạn sẽ thấy các chỉ số riêng do script tự định nghĩa, ví dụ
`feed_first_page_ms` (độ trễ trang đầu) và `feed_deep_page_ms` (độ trễ khi cuộn
sâu). So sánh hai con số này để biết cuộn vô hạn có bị chậm dần không.

Cuối cùng là phần **THRESHOLDS** (ngưỡng đạt). Dấu tích xanh nghĩa là đạt ngưỡng
đã đặt, dấu chéo đỏ nghĩa là không đạt. Ngưỡng nằm trong phần `thresholds` của
mỗi file script, bạn có thể sửa cho phù hợp.

**Lưu kết quả ra file để đưa vào báo cáo:**

```bash
k6 run --summary-export=ket-qua-feed.json load-test/02-feed-following.js
```

---

# PHẦN 6. THEO DÕI HỆ THỐNG TRONG LÚC ĐANG CHẠY

Chỉ nhìn số của k6 thì bạn biết hệ thống **chậm**, nhưng không biết **chậm ở
đâu**. Hãy mở thêm hai hoặc ba cửa sổ terminal chạy song song với bài đo.

## Theo dõi CPU và bộ nhớ của các container

```bash
docker stats
```

Nếu PostgreSQL chiếm gần 100 phần trăm CPU, nút thắt nằm ở cơ sở dữ liệu. Nếu
Redis chiếm nhiều bộ nhớ và tiến gần giới hạn, bạn sắp gặp lỗi OOM.

## Theo dõi số kết nối tới PostgreSQL

Đây là chỉ số **rất quan trọng** và có thể là phát hiện lớn nhất của bạn.

```bash
docker exec postgres_datn psql -U <tên_user> -d "social-network-SNet" -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"
```

**Vì sao quan trọng.** Trong `database.module.ts`, dự án của bạn **không cấu hình
kích thước connection pool** (bể kết nối). Khi không cấu hình, thư viện `pg` dùng
giá trị mặc định là **10 kết nối**.

Nghĩa là dù có 500 người dùng ảo gửi yêu cầu cùng lúc, backend cũng chỉ mở được
tối đa 10 kết nối tới PostgreSQL. Các yêu cầu còn lại phải **xếp hàng chờ**.

Nếu bạn thấy số kết nối ở trạng thái `active` luôn dừng ở đúng 10 trong khi CPU
của máy vẫn còn rảnh, thì bạn đã tìm ra nút thắt cổ chai thật sự. Đây là một kết
luận rất đáng giá cho báo cáo, kèm hướng khắc phục cụ thể: cấu hình
`extra: { max: 50 }` cho TypeORM.

## Theo dõi bộ nhớ Redis

```bash
docker exec redis_datn redis-cli -a <mật_khẩu> INFO memory
```

Tìm dòng `used_memory_human`.

---

# PHẦN 7. BA GIẢ THUYẾT CẦN KIỂM CHỨNG

Đây là ba điểm nghi ngờ tôi rút ra khi đọc code, nhưng **chưa được kiểm chứng
bằng số liệu**. Nhiệm vụ của bạn là chạy các bài đo trên để xác nhận hoặc bác bỏ.

Nếu kiểm chứng được, chúng trở thành **đóng góp phân tích** của bạn trong báo
cáo, chứ không phải lỗi cần xấu hổ.

## Giả thuyết 1. Nút thắt nằm ở connection pool của cơ sở dữ liệu

**Nội dung.** File `database.module.ts` không đặt `extra.max`, nên pool mặc định
chỉ có 10 kết nối. Đây có thể là trần thông lượng thật sự của hệ thống.

**Cách kiểm chứng.** Chạy bài 2 với số VU tăng dần, đồng thời theo dõi
`pg_stat_activity`. Nếu số kết nối `active` bão hoà ở đúng 10 trong khi CPU chưa
đầy, giả thuyết được xác nhận.

## Giả thuyết 2. Có lỗi N+1 khi đọc bảng tin

**Nội dung.** Trong `feed.service.ts`, hàm `getCelebrityPostIds()` dùng vòng lặp
`for` và gọi lệnh Redis `GET` riêng lẻ cho **từng** người mà user đang theo dõi.
Dữ liệu mẫu cho mỗi người theo dõi từ 5 đến 15 người khác, nghĩa là mỗi lần đọc
bảng tin phải đi và về Redis từ 5 đến 15 lần thay vì gộp làm một.

**Cách kiểm chứng.** So sánh p95 của bài 2 giữa những người dùng theo dõi ít
người và những người theo dõi nhiều người. Nếu độ trễ tăng tỷ lệ thuận với số
người đang theo dõi, giả thuyết được xác nhận.

**Hướng khắc phục để viết vào báo cáo.** Gộp các lệnh GET thành một lệnh MGET
hoặc dùng pipeline của Redis, giảm từ 15 lượt đi về xuống còn 1.

## Giả thuyết 3. WebSocket có bão broadcast với độ phức tạp O(n²)

**Nội dung.** Đã giải thích chi tiết ở bài đo số 5.

**Cách kiểm chứng.** Chạy bài 5 với 100, rồi 300, rồi 600 socket. Ghi lại chỉ số
`ws_userStatusChanged_received` ở mỗi mức. Nếu số này tăng theo bình phương (ví
dụ gấp 3 số socket thì số tin nhắn gấp khoảng 9 lần), giả thuyết được xác nhận.

---

# PHẦN 8. CÁCH ĐƯA SỐ LIỆU VÀO BÁO CÁO

## Bảng số liệu nên trình bày

Với mỗi bài đo, hãy lập một bảng như sau. Chạy lại bài đo với nhiều mức VU khác
nhau để điền đủ các dòng.

| Số người dùng ảo | Thông lượng (yêu cầu mỗi giây) | Độ trễ p95 (ms) | Độ trễ p99 (ms) | Tỷ lệ lỗi (%) |
|---|---|---|---|---|
| 25 | | | | |
| 50 | | | | |
| 100 | | | | |
| 200 | | | | |

## Cách diễn giải bảng này trong báo cáo

Có hai điều bạn cần rút ra:

**Thứ nhất, độ trễ p95 có phẳng không.** Nếu p95 gần như không đổi khi tăng số
người dùng ảo, bạn viết được câu này:

> "Độ trễ p95 của bảng tin theo dõi gần như không đổi khi tăng tải, cho thấy chi
> phí đọc bảng tin dựng sẵn trong Redis không phụ thuộc vào số lượng người dùng
> đồng thời. Kết quả này phù hợp với độ phức tạp lý thuyết O(log n + k) của lệnh
> ZREVRANGEBYSCORE."

**Thứ hai, điểm gãy nằm ở đâu.** Điểm gãy (breaking point) là mức tải mà tại đó
độ trễ bắt đầu tăng vọt và tỷ lệ lỗi vượt ngưỡng chấp nhận được. Đây là con số
thuyết phục nhất trong toàn bộ bài đo.

## Lời khuyên quan trọng nhất

**Đừng giấu con số xấu.**

Một đồ án viết rằng:

> "Hệ thống đạt thông lượng 150 yêu cầu mỗi giây với độ trễ p95 dưới 300ms. Điểm
> gãy xuất hiện ở mức 200 người dùng đồng thời, nguyên nhân được xác định là bể
> kết nối cơ sở dữ liệu chỉ có 10 kết nối theo mặc định. Hướng khắc phục là cấu
> hình lại tham số extra.max của TypeORM."

sẽ được đánh giá **cao hơn nhiều** so với một đồ án chỉ viết:

> "Hệ thống hoạt động ổn định, chưa ghi nhận lỗi nghiêm trọng."

Lý do: hội đồng đánh giá **khả năng phân tích và tư duy hệ thống** của bạn, chứ
không đánh giá xem sản phẩm có hoàn hảo hay không. Một sinh viên biết chỉ ra điểm
yếu của chính hệ thống mình và đề xuất được cách sửa, đó mới là người đã thực sự
hiểu hệ thống.

---

# PHẦN 9. XỬ LÝ SỰ CỐ THƯỜNG GẶP

## Tỷ lệ lỗi rất cao, mã lỗi 429

Bạn chưa nới rate limit. Quay lại Phần 2, Việc 1.

## Tỷ lệ lỗi cao, mã lỗi 500

Nhiều khả năng Redis đã hết bộ nhớ. Kiểm tra bằng lệnh `INFO memory` ở Phần 6.
Nếu đúng, quay lại Phần 2, Việc 2.

Cũng có thể là backend bị lỗi. Hãy xem log của backend.

## Script báo lỗi "Login thất bại"

Kiểm tra ba điều:

1. Backend đã chạy chưa? Mở trình duyệt vào `http://localhost:3000` xem có phản
   hồi không.
2. Đã chạy seed chưa? Nếu chưa có user `traveler1@vn.seed` thì không đăng nhập
   được.
3. Cổng có đúng là 3000 không? Nếu backend chạy cổng khác, hãy chạy k6 với biến
   môi trường:
   ```bash
   k6 run -e BASE_URL=http://localhost:8080 load-test/01-baseline.js
   ```

## Độ trễ lần đầu rất cao rồi sau đó giảm hẳn

Đây chính là cold start. Bạn chưa chạy bài làm nóng. Quay lại Phần 2, Việc 3.

## Bài đo WebSocket không kết nối được

Kiểm tra xem backend có đang chạy ở cổng 3000 không. Script kết nối tới
`ws://localhost:3000/socket.io/?EIO=4&transport=websocket`, đây là địa chỉ mặc
định của Socket.IO.

Lưu ý: trong thư mục `core-api/test/` có một file `socket.js` cũ dùng địa chỉ
`ws://localhost:3000/chat`. Địa chỉ đó **sai và đã lỗi thời**, đừng dựa vào nó.
