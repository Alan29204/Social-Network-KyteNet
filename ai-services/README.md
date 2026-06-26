### Tạo môi trường:

```bash
python3 -m venv venv
```

### Kích hoạt môi trường:

```bash
source venv/bin/activate
```

### Cài đặt các thư viện cần thiết:

```bash
pip install -r requirements.txt
```

### Chaỵ dự án:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Phạm vi service

Service này chỉ giữ các chức năng AI đang dùng trong hệ thống:

- Embed bài viết vào ChromaDB.
- Tìm kiếm ngữ nghĩa.
- Gợi ý nội dung cá nhân hóa.
- Reindex embedding bài viết.

Các thành phần kiểm duyệt media/image/video đã được gỡ bỏ để giảm dung lượng image.
