# Ứng Dụng Thực Đơn Nhà Hàng (SSR với Express & Prisma ORM)

Dự án được xây dựng theo đúng yêu cầu bài giảng **"SSR với database và ORM"** (MSc. Ngô Ngọc Đăng Khoa) môn Phát triển ứng dụng web.

---

## 🌟 Tính Năng & Tiêu Chí Nghiệm Thu

1. **Cụm 1 - Khách hàng (User-facing):**
   - **Danh sách món ăn:** `GET /dishes` — Hiển thị thực đơn món Việt, có tìm kiếm theo tên món bằng query param `?q=...`.
   - **Chi tiết món ăn:** `GET /dishes/:id` — Hiển thị đầy đủ thông tin món ăn qua path param. Trả về mã lỗi **404** nếu ID sai hoặc không tồn tại.
   - Chưa yêu cầu phân trang (đúng yêu cầu đề bài).

2. **Cụm 2 - Quản trị viên (Admin):**
   - Quản lý đầy đủ **CRUD** cho 3 đối tượng:
     - 🍲 **Món ăn** (`/admin/dishes`)
     - 👨‍🍳 **Đầu bếp** (`/admin/chefs`)
     - 🥬 **Nguyên liệu** (`/admin/ingredients`)
   - **Thao tác HTTP chuẩn mực:**
     - Thêm mới dùng `POST`
     - Chỉnh sửa dùng `PATCH` (kết hợp `method-override`)
     - Xóa dùng `DELETE` (kết hợp `method-override`)
     - **Tuyệt đối không dùng `GET` để sửa hay xóa dữ liệu.**
     - **Toàn bộ CRUD dùng HTML form submit (SSR), không sử dụng `fetch` hay AJAX.**
     - ⚠️ **Ngoại lệ duy nhất về JavaScript:** Form nhập món ăn trong admin có đoạn JS nhỏ inline (`oninput`) để xem trước ảnh ngay khi gõ URL — đây là tính năng UX phụ trợ, không liên quan đến gửi/nhận dữ liệu.
   - **Mô hình Post/Redirect/Get (PRG):**
     - Thao tác ghi thành công chuyển hướng với mã HTTP **303 See Other**.
     - Nhấn F5 / Reload trên trình duyệt không bị lặp lại thao tác hay tạo trùng bản ghi.
   - **Xác nhận xóa:**
     - Xóa chỉ xảy ra sau khi người dùng đi qua trang xác nhận (`GET /admin/:resource/:id/delete`).
   - **Validation & Xử lý mã lỗi:**
     - Input sai/thiếu trả về mã **400 Bad Request**, giữ lại toàn bộ dữ liệu người dùng đã gõ.
     - ID không hợp lệ hoặc không tìm thấy trả về mã **404 Not Found**.
     - Xử lý ngoại lệ tập trung trả về mã **500 Internal Server Error**.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Bước 1: Cấu hình chuỗi kết nối Database (Supabase)
Tạo file `.env` từ file mẫu `.env.example`:

```bash
cp .env.example .env
```

Mở file `.env` và điền chuỗi kết nối `DATABASE_URL` từ Supabase của bạn (Session pooler, cổng 5432):
```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
PORT=3000
```

> [!NOTE]
> File `.env` đã được cấu hình trong `.gitignore` để đảm bảo chuỗi kết nối bảo mật không bị đẩy lên repository.

### Bước 2: Đồng bộ Schema vào Database
Chạy lệnh sau để tạo 3 bảng (`dishes`, `chefs`, `ingredients`) trên Supabase:

```bash
npx prisma db push
```

### Bước 3: Nạp dữ liệu mẫu ban đầu (Seed Data)
Chạy script seed để nạp sẵn danh sách món ăn Việt Nam, đầu bếp và nguyên liệu:

```bash
npm run seed
```

### Bước 4: Khởi động Server
```bash
npm start
```

Mở trình duyệt truy cập:
- **Thực đơn khách hàng:** `http://localhost:3000/dishes`
- **Trang quản trị:** `http://localhost:3000/admin`
