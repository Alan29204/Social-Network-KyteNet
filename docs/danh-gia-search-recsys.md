# Đánh giá: Tìm kiếm / Ngữ nghĩa / Gợi ý mới / Cá nhân hóa (Snet)

> Chế độ: **chỉ đánh giá, chưa sửa code**. Tài liệu này là báo cáo hiện trạng + đề xuất tối ưu có ưu tiên.

## Kiến trúc tổng quan
- **Keyword search**: `core-api/src/search/` (ILIKE + lọc privacy/block). Tiện ích `buildPostSearchableText` ở `common/utils/searchableText.ts`.
- **Semantic search / Recommend / Embedding**: `ai-services/` (FastAPI) + ChromaDB, model `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 chiều). `core-api` gọi qua `AI_SERVICE_URL` (header `key_auth`).
- **Feed**: `core-api/src/feed/feed.service.ts` — Following (fan-out + Redis), For You (engagement ranking), Recommended (gọi AI `/posts/recommend`).
- **Gợi ý người dùng**: `relations/recommendations.cron.ts` (cron 2h sáng) + `relations.service.ts#getSuggestedUsers` (mutual-followers, cache Redis 24h).

---

## 1. Tìm kiếm (keyword)
**Ổn:** phân trang, lọc block/privacy, endpoint riêng cho users/posts/hashtags; FE debounce 400ms.
**Điểm yếu:**
- **Không xử lý dấu tiếng Việt** — `search.service.ts` dùng `ILIKE %q%`, không `unaccent`/không chuẩn hóa → "ha noi" không ra "Hà Nội", "hôm nay" lệch dấu là trượt. (HIGH)
- **Không full-text index** — ILIKE substring trên `content`/`username`, không `tsvector`/`pg_trgm` → chậm khi dữ liệu lớn, không xếp hạng theo độ liên quan (chỉ `created_at DESC`). (MED)
- **Hashtag match đắt** — `unnest()` + `regexp_replace` mỗi truy vấn. (MED)
- **getFollowingIds/getBlockedUserIds** truy vấn lại mỗi lần tìm kiếm, không cache. (MED)
- **`/search` (All)** cứng 5+5, không phân trang; FE không có "tải thêm" cho từng tab. (LOW)

**Đề xuất:** thêm cột chuẩn hóa `search_text` (lowercase + bỏ dấu ở tầng app) + **GIN `pg_trgm`** index; hoặc bật extension `unaccent`+`pg_trgm` và tạo index. Xếp hạng theo độ tương đồng (similarity) thay vì chỉ thời gian. Cache following/blocked vào Redis (TTL ngắn).

## 2. Tìm kiếm ngữ nghĩa (semantic)
**Ổn:** có ChromaDB, model đa ngôn ngữ, fallback keyword khi AI lỗi (timeout 5s), có nguồn `semantic|keyword_fallback`.
**Điểm yếu:**
- **Không có ngưỡng relevance** — `chromadb.suggest_posts` có `max_distance` nhưng không dùng → trả cả kết quả lạc đề. (HIGH)
- **Phân trang overfetch** — lấy `page*page_size` rồi cắt, tốn khi trang lớn. (MED)
- **Không hybrid** keyword+semantic; semantic không re-rank kết hợp tín hiệu mới (like/comment). (MED)
- **Embedding khi tạo bài**: chạy trong queue (tốt) nhưng **không retry / không dead-letter** nếu AI lỗi → bài không bao giờ được index. (MED)
- **Embedding khi SỬA bài: đồng bộ** (`posts.service.ts upsertPostEmbedding` chặn request). (MED)
- **Reindex reset toàn bộ collection** → mất gợi ý/semantic trong lúc reindex. (MED)

**Đề xuất:** đặt ngưỡng distance + re-rank; đưa upsert-embedding-khi-sửa vào queue; thêm retry/backoff + DLQ cho job embed; reindex kiểu rolling (không reset).

## 3. Gợi ý nội dung mới + Feed "For You"
**Ổn:** có công thức engagement + time-decay, lọc block/following/privacy, dedup repost.
**Điểm yếu:**
- **Quét toàn bảng + GROUP BY/COUNT(DISTINCT)** trên mọi post công khai, **không giới hạn thời gian, không cache** (`feed.service.ts:158-217`). Chậm tuyến tính theo số post. (HIGH)
- **N+1 enrich** (`feed.service.ts:698-706`): mỗi post 2 query (`is_reposted`, `count reposts`) → 2×N. (HIGH)
- **Thiếu index** `shared_post_id`; thiếu index thời gian cho For You. (MED)
- **Không đa dạng/không chống lặp impression** — cuộn nhiều lần thấy lại post cũ. (MED)
- **Tín hiệu nghèo** — thiếu shares/saves/clicks/dwell; trọng số hardcode. (MED)

**Đề xuất:** giới hạn cửa sổ thời gian (vd 14–30 ngày) + giới hạn pool ứng viên rồi cache top-N (cron/Redis); **gộp N+1 thành 2 truy vấn batch**; thêm index `shared_post_id` + `(created_at)`; cân nhắc thêm shares/saves vào điểm.

## 4. Gợi ý cá nhân hóa (Recommended) + Gợi ý người dùng
**Ổn:** pipeline embedding theo lịch sử (like/save/own), cold-start fallback về For You; suggested users mutual-followers + cron + cache + invalidation đầy đủ.
**Điểm yếu:**
- **Mean-pooling không trọng số** (`ai-services/services/post.py:122-128`) — like cũ và mới như nhau; mọi loại tương tác như nhau. (MED)
- **Không đa dạng hóa (MMR)** — top-K dễ trùng tác giả/chủ đề. (HIGH cho chất lượng)
- **Recommend không lọc privacy/block ở AI** — dựa core-api lọc lại sau (ổn nhưng có thể trả thiếu sau lọc). (MED)
- **Recommended feed không phân trang** (`use-recommended-feed.ts`) — hết 20 item là dừng. (LOW)
- **Cold-start người dùng mới**: recommend rỗng → về For You; suggested users rỗng nếu chưa follow ai (không fallback sang user phổ biến/đang hoạt động). (MED)
- **Gọi AI chặn 8s**; quan hệ (following/blocked) không cache. (MED)
- **Embedding tĩnh** — không cập nhật theo tương tác về sau. (LOW)
- **Cron suggested 1 lần/ngày** → có thể cũ; fallback SQL lặp lại y hệt cron (tốn 2x khi miss). (LOW)

**Đề xuất:** pooling theo recency/engagement (trọng số giảm dần); đa dạng hóa MMR; cold-start gợi ý user phổ biến/đang hoạt động; cân nhắc phân trang recommended; cache quan hệ.

---

## Ưu tiên đề xuất (khi bạn muốn triển khai)
**P1 — Hiệu năng/đúng đắn, ít rủi ro:**
1. Gộp N+1 ở `enrichInteractions` (2 query batch thay vì 2×N).
2. Cache `following/blocked IDs` (Redis TTL ngắn) dùng chung feed + search.
3. For You: thêm cửa sổ thời gian + giới hạn pool + cache top-N.
4. Thêm index: `post.shared_post_id`, `post.created_at`; (search) GIN trigram.
5. Semantic: thêm ngưỡng distance + bỏ overfetch.

**P2 — Chất lượng tìm kiếm:**
6. Tìm kiếm không dấu (cột `search_text` chuẩn hóa + GIN `pg_trgm`), xếp hạng theo similarity.
7. Hybrid keyword + semantic cho tab AI.

**P3 — Chiều sâu cá nhân hóa:**
8. Pooling theo recency/engagement + đa dạng hóa MMR.
9. Cold-start: fallback user phổ biến/đang hoạt động; phân trang recommended.
10. Đưa embedding-khi-sửa vào queue + retry/DLQ; reindex rolling.

## Cách kiểm chứng (khi triển khai)
- Bật log thời gian truy vấn / `EXPLAIN ANALYZE` cho For You & search trước–sau.
- So sánh số query mỗi lần tải feed (kỳ vọng giảm từ ~2N xuống hằng số).
- Test không dấu: "ha noi" → "Hà Nội"; "hom nay" → "hôm nay".
- Semantic: truy vấn lạc đề phải bị cắt bởi ngưỡng distance.
- Recommended: kiểm tra đa dạng tác giả trong 20 kết quả; cold-start user mới vẫn có nội dung.
