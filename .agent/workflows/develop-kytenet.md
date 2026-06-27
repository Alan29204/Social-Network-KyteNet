---
description: Phát triển và hoàn thiện ứng dụng KyteNet (Frontend & Backend)
---

**Các yêu cầu quan trọng:**

1. **Đồng bộ API:** Sử dụng Orval để tự động tạo API client cho Frontend từ OpenAPI specification (JSON) được xuất ra từ Backend.
2. **Backend (NestJS):**
   - Đảm bảo server chạy trên port được cấu hình trong `.env`.
   - Tự động xuất file `open-api.json` vào thư mục `.open-api/` ở gốc dự án.
   - Sử dụng các decorator `Doc()` để document API đầy đủ.
3. **Frontend (React):**
   - Sử dụng TanStack Query (React Query) với các hooks được tạo từ Orval.
   - Custom Axios client tại `src/services/apis/axios-client.ts`.
4. **Quy trình:**
   - Luôn kiểm tra trạng thái Docker (Postgres, Redis) trước khi chạy Backend.
   - Sau khi cập nhật Backend, chạy `npm run gen:api` ở Frontend để cập nhật client.
5. Việc chạy ứng dụng như task dev, npm run dev, npm run start:dev tôi đã chạy sẵn rồi
