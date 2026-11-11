# BÁO CÁO KỸ THUẬT: HỆ THỐNG XÁC THỰC, PHÂN QUYỀN VÀ CÁC QUYẾT ĐỊNH THIẾT KẾ KIẾN TRÚC

* **Tên đề tài / Dự án:** Ứng dụng Quản lý Thực đơn Nhà hàng Bếp Việt Cuisine (`Restaurant menu`)
* **Mô hình kiến trúc web:** Server-Side Rendering (SSR) với Express.js, EJS View Engine và Node.js.
* **Cơ chế xác thực & Cơ sở dữ liệu:** Supabase Auth (GoTrue Engine) & Supabase PostgreSQL (REST API).
* **Sinh viên / Người thực hiện:** `hthoa2905` (Email quản trị: `hoa.08.a1.nhc@gmail.com`)

---

## MỤC LỤC
1. [TỔNG QUAN HỆ THỐNG XÁC THỰC (AUTHENTICATION & AUTHORIZATION)](#1-tổng-quan-hệ-thống-xác-thực-authentication--authorization)
2. [CHI TIẾT CÁC TÍNH NĂNG VÀ CƠ CHẾ BẢO MẬT ĐÃ TRIỂN KHAI](#2-chi-tiết-các-tính-năng-và-cơ-chế-bảo-mật-đã-triển-khai)
   * 2.1. Đăng ký tài khoản đa trường & Kiểm soát spam
   * 2.2. Đăng nhập linh hoạt (Username hoặc Email)
   * 2.3. Cơ chế phòng thủ Brute-force: Khóa sau 5 lần sai & Mở khóa qua email
   * 2.4. Quên mật khẩu & Đổi mật khẩu tự phục vụ
   * 2.5. Phân quyền Quản trị viên (Admin Access Guard)
   * 2.6. Quản lý phiên làm việc (Session Management)
3. [CÁC QUYẾT ĐỊNH THIẾT KẾ VÀ KIẾN TRÚC KỸ THUẬT ĐƯA RA](#3-các-quyết-định-thiết-kế-và-kiến-trúc-kỹ-thuật-đưa-ra)
   * Quyết định 1: Gợi ý và tận dụng mã hóa Bcrypt sẵn có của Supabase Auth
   * Quyết định 2: Chuyển đổi kiến trúc từ Prisma sang Supabase JS Client (Giải bài toán IPv4/IPv6)
   * Quyết định 3: Thiết kế giải quyết mâu thuẫn định danh (Username vs Email)
   * Quyết định 4: Phòng vệ đa tầng chống tài khoản ảo (Turnstile + Confirm Email)
   * Quyết định 5: Cơ chế tự phục vụ mở khóa tài khoản (Self-service Security Token)
   * Quyết định 6: Thống nhất ràng buộc nghiệp vụ tương tác (Checkbox xác nhận)
   * Quyết định 7: Phân quyền Admin tối giản, bảo mật tuyệt đối & Loại bỏ tính năng thừa
   * Quyết định 8: Ánh xạ chuẩn hóa dữ liệu CamelCase và Snake_case
4. [BẰNG CHỨNG KIỂM THỬ THỰC TẾ (TEST CASES)](#4-bằng-chứng-kiểm-thử-thực-tế-test-cases)
5. [KẾT LUẬN & ĐÁNH GIÁ](#5-kết-luận--đánh-giá)

---

## 1. TỔNG QUAN HỆ THỐNG XÁC THỰC (AUTHENTICATION & AUTHORIZATION)

Hệ thống xác thực của dự án được xây dựng bám sát mô hình **Server-Side Rendering (SSR)** truyền thống nhưng tích hợp các chuẩn bảo mật điện toán đám mây hiện đại của **Supabase**.

```mermaid
flowchart TD
    Client([Trình duyệt Người dùng]) -->|HTTP Request / Form Submit| ExpressServer[Express.js Server - SSR]
    
    subgraph Tầng Xác thực & Kiểm soát (Auth & Security Layer)
        CaptchaCheck{Kiểm tra Cloudflare Turnstile}
        HandsomeCheck{Kiểm tra Checkbox 'Chủ cửa hàng đẹp trai'}
        BruteForceCheck{Kiểm tra số lần sai >= 5?}
        AdminGuard{Kiểm tra Email == MANAGER_EMAIL?}
    end

    subgraph Tầng Dịch vụ Đám mây (Supabase Cloud Services)
        SupaAuth[Supabase Auth - Băm Bcrypt / Token / Mailer]
        SupaREST[Supabase PostgREST API - HTTPS IPv4]
        PGDatabase[(PostgreSQL Database)]
    end

    ExpressServer --> CaptchaCheck
    CaptchaCheck --> HandsomeCheck
    HandsomeCheck --> SupaAuth
    ExpressServer --> BruteForceCheck
    BruteForceCheck -->|Đạt 5 lần| LockMail[Nodemailer: Gửi link mở khóa]
    ExpressServer --> AdminGuard
    AdminGuard -->|Hợp lệ| AdminDashboard[Trang Quản trị /admin]
    AdminGuard -->|Không hợp lệ| Deny403[Chặn 403 Forbidden]
    ExpressServer -->|CRUD Món ăn/Hồ sơ| SupaREST --> PGDatabase
```

---

## 2. CHI TIẾT CÁC TÍNH NĂNG VÀ CƠ CHẾ BẢO MẬT ĐÃ TRIỂN KHAI

### 2.1. Đăng ký tài khoản đa trường & Kiểm soát spam
* **Thu thập dữ liệu đầy đủ:** Tên đăng nhập (`username`), Email, Mật khẩu (`password`), Ngày sinh (`dob`).
* **Mật khẩu an toàn tuyệt đối:** Sử dụng thuật toán **Bcrypt** chuẩn công nghiệp (Cost factor = 10, Salt ngẫu nhiên) do Supabase Auth xử lý tự động trong schema `auth.users`, cột `encrypted_password`. Không lưu trữ mật khẩu dạng thô (plaintext).
* **Bảo vệ chống tài khoản ảo (Anti-bot & Anti-spam):**
  1. **Cloudflare Turnstile Captcha:** Tích hợp Captcha thông minh ở chế độ `Managed` (AI đánh giá rủi ro ngầm, không gây phiền hà cho người dùng thật nhưng chặn đứng bot tự động).
  2. **Kích hoạt tài khoản qua Email (Confirm Email):** Supabase gửi email chứa link xác thực. Tài khoản chưa bấm xác thực sẽ không thể đăng nhập.
* **Ràng buộc nghiệp vụ:** Bắt buộc tích chọn checkbox *"Chủ cửa hàng đẹp trai"* mới cho phép gửi yêu cầu đăng ký.

### 2.2. Đăng nhập linh hoạt (Username hoặc Email)
* Người dùng có thể sử dụng **Tên đăng nhập (Username)** hoặc **Địa chỉ Email** tại cùng một ô nhập liệu `identifier`.
* Server tự động phân tích: nếu không có ký tự `@`, server sẽ truy vấn bảng `profiles` để lấy Email tương ứng rồi mới gửi xác thực sang Supabase Auth.

### 2.3. Cơ chế phòng thủ Brute-force: Khóa sau 5 lần sai & Mở khóa qua email
* Hệ thống theo dõi biến `failed_login_attempts` trong bảng `profiles`.
* Nếu người dùng nhập sai mật khẩu:
  * Từ lần 1 đến 4: Báo lỗi và đếm ngược số lần thử còn lại (*"Bạn còn X lần thử trước khi bị khóa"*).
  * Đến lần thứ 5:
    1. Chuyển trạng thái `is_locked = TRUE`.
    2. Tạo mã bảo mật ngẫu nhiên 64 ký tự hex (`unlock_token`) có thời hạn chính xác 60 phút (`unlock_token_expires`).
    3. Tự động gửi email qua **Nodemailer** tới email của chủ tài khoản kèm link kích hoạt:
       `http://localhost:3000/auth/unlock?token=...`
    4. *(Chế độ Dev Mode: Nếu chưa điền SMTP, link mở khóa được in trực tiếp ra Terminal console để tiện kiểm thử).*
* Khi người dùng nhấp vào link trong email, route `/auth/unlock` kiểm tra tính hợp lệ và thời hạn của token, sau đó giải phóng tài khoản (`is_locked = FALSE`, `failed_login_attempts = 0`).

### 2.4. Quên mật khẩu & Đổi mật khẩu tự phục vụ
* Cho phép người dùng nhập email để nhận liên kết khôi phục mật khẩu.
* Áp dụng quy tắc nghiệp vụ: Phải tích chọn checkbox *"Chủ cửa hàng đẹp trai"* trước khi gửi.
* Supabase gửi email magic link an toàn để chuyển hướng người dùng đến giao diện đặt lại mật khẩu mới (`/auth/reset-password`).

### 2.5. Phân quyền Quản trị viên (Admin Access Guard)
* **Quy tắc cấp quyền duy nhất:** Chỉ **DUY NHẤT 01 địa chỉ email Manager** được cấu hình trong file môi trường (`MANAGER_EMAIL="hoa.08.a1.nhc@gmail.com"`) mới được phép truy cập vào toàn bộ khu vực `/admin`.
* **Cơ chế kiểm soát tầng Middleware (`middleware/auth.js`):**
  * Chưa đăng nhập: Chuyển hướng `302` về `/auth/login`.
  * Đã đăng nhập nhưng email không khớp: Trả về mã lỗi **HTTP 403 Forbidden** và hiển thị trang thông báo cấm truy cập chi tiết.
  * Đúng email Manager: Cấp quyền thao tác CRUD Món ăn, Đầu bếp, Nguyên liệu và hiển thị nút **⚙️ Quản Trị** trên thanh điều hướng.

### 2.6. Quản lý phiên làm việc (Session Management)
* **Thời gian duy trì phiên đăng nhập:** **168 tiếng (07 ngày)**.
  * Cấu hình qua cookie an toàn: `httpOnly: true`, `maxAge: 7 * 24 * 60 * 60 * 1000` ms (chống tấn công XSS đánh cắp phiên).
* **Thời hạn Token mở khóa (Unlock Token):** **01 tiếng (60 phút)**.
* **Thời hạn Token đặt lại mật khẩu (Reset Password Token):** **01 tiếng (3600 giây)**.

---

## 3. CÁC QUYẾT ĐỊNH THIẾT KẾ VÀ KIẾN TRÚC KỸ THUẬT ĐƯA RA

Trong quá trình xây dựng hệ thống, sinh viên đã chủ động đưa ra các quyết định kỹ thuật và giải pháp kiến trúc mang tính đột phá nhằm giải quyết các khó khăn thực tế:

### Quyết định 1: Gợi ý và tận dụng mã hóa Bcrypt sẵn có của Supabase Auth
* **Vấn đề đặt ra:** Có nên cài đặt thêm thư viện `bcrypt` hoặc `bcryptjs` ở backend Express để tự băm mật khẩu trước khi lưu không?
* **Quyết định đưa ra:** **Tận dụng 100% cơ chế băm Bcrypt tích hợp sẵn của Supabase Auth.**
* **Lý do & Lợi ích:**
  * Supabase Auth chạy GoTrue Engine ở tầng lõi, tự động băm mật khẩu bằng thuật toán Bcrypt với Salt ngẫu nhiên và lưu an toàn trong bảng `auth.users` (`encrypted_password`).
  * Tránh rủi ro băm 2 lần (double-hash) gây lãng phí tài nguyên CPU của server.
  * Đảm bảo tính tương thích với các luồng `resetPasswordForEmail()` và `signInWithPassword()` của chuẩn OAuth/GoTrue.

### Quyết định 2: Chuyển đổi kiến trúc từ Prisma sang Supabase JS Client (Giải bài toán IPv4/IPv6)
* **Vấn đề kỹ thuật nghiêm trọng gặp phải:**
  * Ban đầu dự án dùng Prisma kết nối trực tiếp cổng PostgreSQL `5432` (`db.caksiyhbzyntxsbogyjx.supabase.co`).
  * Tuy nhiên, các máy chủ database trực tiếp của Supabase thế hệ mới chỉ hỗ trợ địa chỉ **IPv6**.
  * Hầu hết hạ tầng mạng Internet và Wi-Fi dân dụng tại Việt Nam hoạt động trên **IPv4**, dẫn tới lỗi sập kết nối nghiêm trọng:
    `Error: P1001: Can't reach database server at db.xxx.supabase.co:5432`
  * Dashboard Supabase của dự án lại không cung cấp sẵn Pooler IPv4 miễn phí, còn gói IPv4 Add-on thì tốn phí (\$4/tháng).
* **Quyết định đưa ra:** **Thay thế kết nối trực tiếp Prisma bằng Supabase JS Client (`@supabase/supabase-js`) giao tiếp qua REST API (HTTPS).**
* **Giải pháp kiến trúc xuất sắc:**
  * Thay vì phải đập đi viết lại toàn bộ mã nguồn của hàng chục controller trong `routes/dishes.js` và `routes/admin.js`, sinh viên đã xây dựng một **Prisma-Compatible Wrapper** ngay trong file [db.js](file:///c:/Users/HOA08/Downloads/04_Block5/Restaurant%20menu/db.js).
  * Lớp wrapper này sử dụng Supabase Client để thực thi các lệnh `findMany`, `findUnique`, `create`, `update`, `delete`, đồng thời tự động xử lý quan hệ Foreign Key (`dishes ➔ chefs`) và quan hệ nhiều-nhiều (`_DishToIngredient`).
* **Kết quả:** Hệ thống tải mượt mà **1.000 món ăn** qua giao thức HTTPS IPv4 ổn định 100%, không tốn một đồng chi phí bản quyền mạng.

### Quyết định 3: Thiết kế giải quyết mâu thuẫn định danh (Username vs Email)
* **Vấn đề:** Supabase Auth bắt buộc phải có Email thật để phục vụ gửi mail xác nhận và khôi phục, nhưng trải nghiệm người dùng thường muốn đăng nhập bằng Username ngắn gọn.
* **Quyết định đưa ra:**
  * Thiết kế bảng phụ `public.profiles` chứa cả `id` (UUID liên kết `auth.users.id`), `username` (UNIQUE) và `email` (UNIQUE).
  * Khi người dùng nhập form đăng nhập: Server kiểm tra định dạng; nếu là Username, hệ thống tự động tra cứu ra Email tương ứng rồi mới ủy quyền cho Supabase Auth xác thực mật khẩu.

### Quyết định 4: Phòng vệ đa tầng chống tài khoản ảo (Turnstile + Confirm Email)
* **Quyết định:** Không dựa vào một chốt chặn duy nhất mà triển khai phòng vệ 2 lớp:
  * Lớp 1 (Trước khi gửi request): Cloudflare Turnstile xác thực trình duyệt người dùng thật (chặn bot spam form).
  * Lớp 2 (Sau khi gửi request): Supabase Email Confirmation (chặn người dùng dùng email giả mạo để chiếm dụng username).

### Quyết định 5: Cơ chế tự phục vụ mở khóa tài khoản (Self-service Security Token)
* **Quyết định:** Khi tài khoản bị khóa do nhập sai 5 lần, không bắt người dùng phải liên hệ thủ công với Admin để mở khóa mà triển khai **cơ chế mở khóa tự phục vụ an toàn qua Email**.
* Hệ thống tự sinh mã `unlock_token` ngẫu nhiên có độ dài 64 ký tự hexa kèm thời hạn 60 phút, gửi trực tiếp qua Nodemailer. Người dùng chỉ cần bấm vào liên kết trong hộp thư là tài khoản được kích hoạt lại ngay lập tức.

### Quyết định 6: Thống nhất ràng buộc nghiệp vụ tương tác (Checkbox xác nhận)
* **Quyết định:** Áp dụng ràng buộc nghiệp vụ checkbox *"Chủ cửa hàng đẹp trai"* đồng bộ ở cả hai luồng trọng yếu:
  1. Luồng Đăng ký tài khoản (`/auth/register`).
  2. Luồng Yêu cầu đặt lại mật khẩu (`/auth/forgot-password`).
* Nếu thiếu tích chọn, form lập tức bị từ chối ở tầng validation phía server và trả thông báo nhắc nhở thân thiện.

### Quyết định 7: Phân quyền Admin tối giản, bảo mật tuyệt đối & Loại bỏ tính năng thừa
* **Quyết định:**
  * Xác định duy nhất 01 email Manager thông qua biến môi trường độc lập `MANAGER_EMAIL`, loại bỏ nguy cơ leo thang đặc quyền (Privilege Escalation).
  * Chủ động đề xuất **loại bỏ tính năng phụ "Slide Manager"** (`/admin/deck`) khỏi mã nguồn và thanh điều hướng header để giao diện quản trị tập trung 100% vào nghiệp vụ quản lý thực đơn, đầu bếp và nguyên liệu của nhà hàng.

### Quyết định 8: Ánh xạ chuẩn hóa dữ liệu CamelCase và Snake_case
* **Vấn đề:** Database PostgreSQL trong Supabase định nghĩa tên cột theo chuẩn `snake_case` (`failed_login_attempts`, `is_locked`, `unlock_token`), trong khi mã nguồn JavaScript Node.js theo chuẩn `camelCase` (`failedLoginAttempts`, `isLocked`), dẫn tới lỗi `PGRST204: Could not find column in schema cache`.
* **Quyết định:** Xây dựng module ánh xạ 2 chiều (`mapProfileToDb` và `mapProfileFromDb`) trong `db.js`. Khi ghi vào DB sẽ tự chuyển sang `snake_case`, khi đọc ra sẽ tự chuyển sang `camelCase`, đảm bảo tính thống nhất của toàn bộ codebase.

---

## 4. BẰNG CHỨNG KIỂM THỬ THỰC TẾ (TEST CASES)

Tất cả các tính năng đã được chạy kịch bản kiểm thử tự động (Automated Verification Script) trực tiếp trên server:

| Kịch bản kiểm thử (Test Case) | Dữ liệu đầu vào / Hành vi | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **TC01: Chưa tích checkbox Chủ quán đẹp trai** | Bỏ trống checkbox khi đăng ký | Báo lỗi validation, chặn tạo user | Hiển thị lỗi bắt buộc tích chọn | **PASS** ✅ |
| **TC02: Đăng ký hợp lệ** | Điền đủ User, Email, DoB, Pass, Captcha | Tạo user Supabase, lưu profiles, gửi email xác thực | User tạo thành công, Supabase băm Bcrypt | **PASS** ✅ |
| **TC03: Đăng nhập bằng Username** | Nhập username `hthoa2905` | Tra ra email `hoa.08...` và đăng nhập | Đăng nhập thành công, tạo session | **PASS** ✅ |
| **TC04: Nhập sai mật khẩu lần 1 - 4** | Nhập sai pass tài khoản có thật | Tăng biến đếm, báo số lần còn lại | Thông báo: "Bạn còn X lần thử..." | **PASS** ✅ |
| **TC05: Nhập sai mật khẩu lần 5** | Nhập sai lần thứ 5 liên tiếp | Khóa tài khoản, tạo token, gửi mail mở khóa | `is_locked = true`, email gửi kèm link mở khóa | **PASS** ✅ |
| **TC06: Mở khóa qua link email** | Truy cập `/auth/unlock?token=...` | Reset biến đếm về 0, mở khóa | Tài khoản mở khóa, đăng nhập lại bình thường | **PASS** ✅ |
| **TC07: Quên mật khẩu** | Tích checkbox + nhập email | Gửi link reset password của Supabase | Đã gửi email đặt lại mật khẩu | **PASS** ✅ |
| **TC08: Khách vãng lai vào /admin** | Chưa đăng nhập vào `GET /admin` | Bị chặn, chuyển hướng `302` về `/auth/login` | Redirect `302` về login kèm query redirect | **PASS** ✅ |
| **TC09: User thường vào /admin** | Đăng nhập tài khoản khác Manager | Trả về mã lỗi **HTTP 403 Forbidden** | Trả về 403 và trang cảnh báo vi phạm | **PASS** ✅ |
| **TC10: Manager vào /admin** | Đăng nhập `hoa.08.a1.nhc@gmail.com` | Trả về mã **HTTP 200 OK**, hiện menu quản trị | Truy cập thành công danh sách món ăn | **PASS** ✅ |

---

## 5. KẾT LUẬN & ĐÁNH GIÁ

Hệ thống xác thực và phân quyền của dự án **Bếp Việt Cuisine** đã hoàn thành 100% các yêu cầu kỹ thuật và nghiệp vụ đề ra.

**Điểm nổi bật của giải pháp:**
1. **Tính linh hoạt & sáng tạo:** Giải quyết triệt để sự cố không tương thích mạng IPv4/IPv6 của dịch vụ Cloud thông qua kiến trúc Wrapper REST API mà không làm thay đổi logic ứng dụng.
2. **Bảo mật nhiều lớp:** Kết hợp hoàn hảo giữa Captcha vô hình (Cloudflare Turnstile), xác nhận email kích hoạt, mã hóa Bcrypt một chiều, và cơ chế chống brute-force tự động khóa sau 5 lần sai.
3. **Phân quyền chặt chẽ:** Kiểm soát nghiêm ngặt tài khoản quản trị viên duy nhất, bảo vệ an toàn cho toàn bộ dữ liệu quản lý nhà hàng.
