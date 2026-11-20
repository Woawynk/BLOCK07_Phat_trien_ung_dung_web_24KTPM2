# BÁO CÁO TÓM TẮT QUYẾT ĐỊNH TRIỂN KHAI MFA, RBAC VÀ ABAC

**Phạm vi:** Ghi nhận cách sử dụng prompt để xác định yêu cầu và các quyết định thiết kế, triển khai đối với từng tính năng bảo mật. Báo cáo chỉ đề cập những nội dung liên quan trực tiếp đến MFA, RBAC và ABAC.

## 1. Xác thực đa yếu tố (MFA)

### Prompt và yêu cầu được xác định

Người thực hiện cung cấp đường dẫn repository và sử dụng prompt đề nghị AI đánh giá khả năng tích hợp MFA, đồng thời tạo phiên bản cho phép **người dùng tự lựa chọn bật hoặc tắt MFA** và thiết lập Google Authenticator bằng cách **quét mã QR**.

Từ yêu cầu này, phương án được thống nhất là triển khai xác thực bằng mã TOTP, không sử dụng đăng nhập Google OAuth. Google Authenticator đóng vai trò ứng dụng tạo mã, còn máy chủ của hệ thống xác minh mã.

### Các quyết định trong quá trình triển khai

- **MFA là tùy chọn theo tài khoản.** Người dùng chủ động kích hoạt trong phần cài đặt bảo mật; chỉ tài khoản đã kích hoạt mới phải thực hiện bước xác minh bổ sung khi đăng nhập.
- **Sử dụng TOTP tương thích Google Authenticator.** Hệ thống tạo khóa bí mật và mã QR phục vụ việc liên kết ứng dụng xác thực, không yêu cầu cấu hình Google API.
- **Chỉ kích hoạt MFA sau khi xác minh mã đầu tiên.** Việc quét QR chưa đủ để xác nhận thiết lập thành công; người dùng phải nhập mã hợp lệ từ ứng dụng.
- **Không cấp phiên đăng nhập đầy đủ trước khi hoàn tất MFA.** Việc kiểm tra mật khẩu và xác minh mã TOTP được tách thành hai bước, nhằm ngăn truy cập các chức năng được bảo vệ khi mới hoàn thành bước đầu.
- **Bảo vệ thông tin xác thực và cung cấp phương án khôi phục.** Khóa TOTP được mã hóa ở phía máy chủ; mã khôi phục được lưu dưới dạng băm và chỉ dùng một lần. Phiên đăng nhập sử dụng cookie được ký để tránh chỉnh sửa trái phép.
- **Giới hạn số lần thử mã xác thực.** Các yêu cầu nhập mã sai liên tiếp được kiểm soát nhằm giảm nguy cơ dò mã.

### Kết quả triển khai

Bản vá MFA được chuẩn bị với giao diện thiết lập bằng QR, luồng xác minh khi đăng nhập, thao tác bật/tắt MFA, mã khôi phục và thay đổi dữ liệu tài khoản cần thiết. Các quyết định tập trung vào khả năng sử dụng, kiểm soát phiên đăng nhập và bảo vệ bí mật xác thực.

## 2. Phân quyền theo vai trò (RBAC)

### Prompt và yêu cầu được xác định

Prompt của người thực hiện yêu cầu phân chia quyền theo chiều dọc: **một nhóm được sửa, nhóm khác được xóa, các tài khoản còn lại không có các quyền đó**. Sau khi thảo luận ma trận quyền, người thực hiện tiếp tục yêu cầu AI tạo bản vá RBAC.

### Các quyết định trong quá trình triển khai

- **Xác định bốn vai trò:** `manager`, `editor`, `deleter` và `user`.
- **Tách quyền sửa và xóa thành hai quyền độc lập.** Vai trò `editor` không tự động được xóa; vai trò `deleter` không tự động được sửa. Quyền thêm mới được dành cho `manager`.
- **Sử dụng quyền tường minh theo thao tác:** `view`, `create`, `edit`, `delete`, thay vì chỉ kiểm tra người dùng có phải quản trị viên hay không.
- **Kiểm tra quyền ở phía máy chủ.** Middleware kiểm soát cả yêu cầu mở biểu mẫu lẫn yêu cầu thực sự tạo, cập nhật hoặc xóa dữ liệu; không dựa vào việc ẩn nút trên giao diện để bảo vệ hệ thống.
- **Lấy vai trò từ dữ liệu đáng tin cậy.** Quyền được gắn với hồ sơ tài khoản trong cơ sở dữ liệu và không được quyết định bởi thông tin vai trò do trình duyệt tự gửi lên.
- **Giới hạn việc cấp vai trò đặc quyền.** Việc gán `manager`, `editor` hoặc `deleter` được thực hiện qua thao tác quản trị có thẩm quyền, không cho người dùng tự chọn khi đăng ký.

Ma trận quyền được lựa chọn:

| Vai trò | Xem quản lý | Thêm | Sửa | Xóa |
|---|:---:|:---:|:---:|:---:|
| `manager` | Có | Có | Có | Có |
| `editor` | Có | Không | Có | Không |
| `deleter` | Có | Không | Không | Có |
| `user` | Không | Không | Không | Không |

### Kết quả triển khai

Bản vá RBAC được chuẩn bị để áp dụng kiểm tra quyền cho các thao tác quản lý **món ăn, đầu bếp và nguyên liệu**. Giao diện hiển thị chức năng theo vai trò, trong khi quyền truy cập thực tế được quyết định tại các tuyến xử lý trên máy chủ. Trường `role` trong hồ sơ tài khoản được sử dụng để lưu phân quyền.

## 3. Kiểm soát truy cập theo thuộc tính (ABAC)

### Prompt và yêu cầu được xác định

Người thực hiện sử dụng prompt yêu cầu đánh giá khả năng triển khai ABAC trong trạng thái hiện tại của hệ thống. Sau khi xác định phạm vi phù hợp, prompt tiếp theo yêu cầu **tạo bản vá ABAC đơn giản, dựa trên thuộc tính riêng của người dùng và các danh mục được phân công**.

Quyết định trọng tâm là dùng **danh mục món ăn được gán cho từng tài khoản** làm thuộc tính phân quyền, thay vì xây dựng một bộ máy chính sách tổng quát và phức tạp.

### Các quyết định trong quá trình triển khai

- **Lưu danh mục được phép theo từng người dùng.** Thuộc tính `allowed_categories` được bổ sung vào hồ sơ tài khoản, cho phép hai người cùng vai trò có phạm vi thao tác khác nhau.
- **Kết hợp vai trò với thuộc tính.** Vai trò quyết định loại thao tác được thực hiện; danh mục được phân công quyết định bản ghi món ăn nào thuộc phạm vi thao tác đó.
- **Giới hạn quyền sửa theo danh mục.** `editor` chỉ được sửa món thuộc danh mục đã phân công. Nếu đổi danh mục món ăn, danh mục mới cũng phải nằm trong phạm vi được phép, tránh chuyển bản ghi sang danh mục ngoài quyền hạn.
- **Giới hạn quyền xóa theo danh mục và trạng thái.** `deleter` chỉ được xóa món thuộc danh mục đã phân công và đang ở trạng thái không còn phục vụ (`available = false`).
- **Cho phép `manager` xử lý toàn bộ danh mục.** Vai trò này không bị giới hạn bởi danh sách danh mục được phân công.
- **Mặc định từ chối khi thiếu thuộc tính phù hợp.** Tài khoản chưa được gán danh mục không mặc nhiên có quyền sửa hoặc xóa món ăn; dữ liệu danh mục phải được kiểm tra từ phía máy chủ.
- **Giới hạn phạm vi chính sách cho món ăn.** Quy tắc ABAC được tập trung vào thao tác sửa và xóa món ăn, nơi các thuộc tính `category` và `available` có ý nghĩa trực tiếp.

Ví dụ: tài khoản `editor` được gán `Món nước` chỉ sửa được các món trong danh mục đó; tài khoản `deleter` được gán `Tráng miệng` chỉ xóa được món thuộc danh mục này khi món đã ngừng phục vụ.

### Kết quả triển khai

Bản vá ABAC được chuẩn bị với thuộc tính danh mục riêng cho từng hồ sơ, logic đánh giá quyền dựa trên dữ liệu món ăn và các kiểm tra phía máy chủ trước thao tác sửa hoặc xóa. Giao diện quản lý món ăn được điều chỉnh theo kết quả đánh giá quyền của từng bản ghi.

## 4. Tổng hợp việc sử dụng prompt và quyết định

Trong các nội dung liên quan đến ba tính năng, prompt được sử dụng chủ yếu cho ba mục đích: **xác định yêu cầu**, **đánh giá phương án thiết kế** và **yêu cầu tạo bản vá triển khai**. Người thực hiện đưa ra phạm vi chức năng mong muốn; AI phân tích các phương án, đề xuất quy tắc bảo mật và xây dựng mã nguồn tương ứng. Các quyết định được lựa chọn ưu tiên phạm vi rõ ràng, dễ kiểm thử và kiểm soát quyền ở phía máy chủ.

| Tính năng | Trọng tâm của prompt | Quyết định nổi bật |
|---|---|---|
| MFA | MFA tùy chọn, Google Authenticator, quét QR | TOTP, xác nhận thiết lập bằng mã, xác minh trước khi cấp phiên đầy đủ |
| RBAC | Phân tách quyền sửa/xóa và tạo bản vá | Bốn vai trò, quyền thao tác độc lập, kiểm tra tại middleware |
| ABAC | Thuộc tính riêng theo người dùng và danh mục phân công | Phạm vi danh mục theo tài khoản; ràng buộc danh mục hiện tại, danh mục mới và trạng thái món |

**Ghi chú về xác minh:** Các bản vá được chuẩn bị kèm kiểm thử cục bộ theo từng tính năng. Báo cáo này ghi nhận các quyết định và kết quả xây dựng bản vá; không đồng nghĩa với việc tất cả luồng đã được xác nhận vận hành trên môi trường triển khai thực tế.
