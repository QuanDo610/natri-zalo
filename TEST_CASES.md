# Test Cases – Hệ Thống Tích Điểm Natri v3

## A) Xác Thực / OTP / Refresh Token

### TC-A01: Yêu Cầu OTP – KH
- **API**: `POST /auth/otp/request`
- **Input**: `{ "phone": "0351234567" }`
- **Kỳ Vọng**: 200 `{ "message": "OTP đã gửi", "expiresIn": 300 }`

### TC-A02: Xác Thực OTP – KH Thành Công
- **API**: `POST /auth/otp/verify`
- **Input**: `{ "phone": "0351234567", "code": "123456", "role": "CUSTOMER" }`
- **Kỳ Vọng**: 200, body chứa `accessToken`, `refreshToken`, `user.role === "CUSTOMER"`, `user.customerId !== null`

### TC-A03: Xác Thực OTP – ĐL Thành Công
- **API**: `POST /auth/otp/verify`
- **Input**: `{ "phone": "0901234567", "code": "123456", "role": "DEALER" }`
- **Kỳ Vọng**: 200, `user.role === "DEALER"`, `user.dealerId !== null`

### TC-A04: Xác Thực OTP – SĐT ĐL Không Khớp
- **API**: `POST /auth/otp/verify`
- **Input**: `{ "phone": "0999999999", "code": "123456", "role": "DEALER" }`
- **Kỳ Vọng**: 400, `"Không tìm thấy đại lý"`

### TC-A05: Xác Thực OTP – Sai Mã OTP
- **API**: `POST /auth/otp/verify`
- **Input**: `{ "phone": "0351234567", "code": "000000", "role": "CUSTOMER" }`
- **Kỳ Vọng**: 401, `"OTP không hợp lệ hoặc hết hạn"`

### TC-A06: Đăng Nhập NV – Mật Khẩu Thành Công
- **API**: `POST /auth/login`
- **Input**: `{ "username": "staff01", "password": "staff123" }`
- **Kỳ Vọng**: 200, `user.role === "STAFF"`, `accessToken`, `refreshToken` không null

### TC-A07: Đăng Nhập QT – Mật Khẩu Thành Công
- **API**: `POST /auth/login`
- **Input**: `{ "username": "admin", "password": "admin123" }`
- **Kỳ Vọng**: 200, `user.role === "ADMIN"`

### TC-A08: Đăng Nhập NV – Sai Mật Khẩu
- **API**: `POST /auth/login`
- **Input**: `{ "username": "staff01", "password": "wrongpass" }`
- **Kỳ Vọng**: 401, `"Sai thông tin đăng nhập"`

### TC-A09: Làm Mới Token – Thành Công
- **API**: `POST /auth/refresh`
- **Input**: `{ "refreshToken": "<valid>" }`
- **Kỳ Vọng**: 200, nhận accessToken mới + refreshToken mới (rotation)

### TC-A10: Làm Mới Token – Token Đã Revoke
- **API**: `POST /auth/refresh`
- **Input**: `{ "refreshToken": "<revoked>" }`
- **Kỳ Vọng**: 401, `"Refresh token không hợp lệ hoặc hết hạn"`

### TC-A11: Logout – Hủy Token
- **API**: `POST /auth/logout` (Auth header)
- **Input**: `{ "refreshToken": "<valid>" }`
- **Kỳ Vọng**: 200, sau đó refresh bằng token cũ → 401

---

## B) Quản Lý Barcode (NV/QT)

### TC-B01: NV Thêm Barcode – Thành Công
- **API**: `POST /barcodes` (Auth: staff01 JWT)
- **Input**: `{ "code": "8936999001", "productSku": "P001" }`
- **Kỳ Vọng**: 201, body chứa `barcode === "8936999001"`, `product.sku === "P001"`, `createdBy.username === "staff01"`
- **DB Verify**: BarcodeItem có `status: "UNUSED"`, `createdById` = staff01's userId

### TC-B02: QT Thêm Barcode – Thành Công
- **API**: `POST /barcodes` (Auth: admin JWT)
- **Input**: `{ "code": "8936999002", "productSku": "P002" }`
- **Kỳ Vọng**: 201, `createdBy.username === "admin"`

### TC-B03: Thêm Barcode Trùng – 409
- **Điều Kiện Trước**: Barcode "8936000001" đã tồn tại
- **API**: `POST /barcodes` (Auth: staff)
- **Input**: `{ "code": "8936000001", "productSku": "P001" }`
- **Kỳ Vọng**: 409, `"error": "BARCODE_ALREADY_EXISTS"`, `"message"` chứa "8936000001"

### TC-B04: Thêm Barcode – SKU Không Tồn Tại – 404
- **API**: `POST /barcodes` (Auth: staff)
- **Input**: `{ "code": "8936999003", "productSku": "PXXX" }`
- **Kỳ Vọng**: 404, `"Sản phẩm SKU \"PXXX\" không tồn tại"`

### TC-B05: KH Thêm Barcode – 403
- **API**: `POST /barcodes` (Auth: customer JWT)
- **Input**: `{ "code": "8936999004", "productSku": "P001" }`
- **Kỳ Vọng**: 403, Forbidden

### TC-B06: ĐL Thêm Barcode – 403
- **API**: `POST /barcodes` (Auth: dealer JWT)
- **Input**: `{ "code": "8936999005", "productSku": "P001" }`
- **Kỳ Vọng**: 403, Forbidden

### TC-B07: Thêm Barcode Hàng Loạt – Kết Quả Hỗn Hợp
- **API**: `POST /barcodes/batch` (Auth: staff)
- **Input**:
```json
{
  "items": [
    { "code": "8936999010", "productSku": "P001" },
    { "code": "8936000001", "productSku": "P001" },
    { "code": "8936999011", "productSku": "PXXX" }
  ]
}
```
- **Kỳ Vọng**: 200, `total: 3`, `created: 1`, `errors: 2`
  - `details[0].status === "created"`
  - `details[1].status === "error"` (duplicate)
  - `details[2].status === "error"` (product not found)

### TC-B08: GET Barcode – Lọc theo UNUSED
- **API**: `GET /barcodes?status=UNUSED&take=5` (Auth: staff)
- **Kỳ Vọng**: 200, tất cả items có `status === "UNUSED"`

### TC-B09: GET Barcode – Lọc Theo SKU + Tìm Kiếm
- **API**: `GET /barcodes?sku=P001&q=8936&skip=0&take=10` (Auth: admin)
- **Kỳ Vọng**: 200, items chỉ có `product.sku === "P001"`, barcode chứa "8936"

### TC-B10: GET Barcode – KH → 403
- **API**: `GET /barcodes` (Auth: customer)
- **Kỳ Vọng**: 403, Forbidden

---

## C) Kích Hoạt (NV/QT – v3 Change)

### TC-C01: NV Tạo Kích Hoạt – Thành Công
- **API**: `POST /activations` (Auth: staff JWT)
- **Input**:
```json
{
  "barcode": "8936000021",
  "customer": { "name": "Nguyễn Thị Hồng", "phone": "0351234567" },
  "dealerCode": "DL001"
}
```
- **Kỳ Vọng**: 200, `product.name` not null, `customerPointsAfter >= 1`, `dealerPointsAfter >= 1`
- **DB Verify**: BarcodeItem `activated=true`, `status="USED"`, `usedById` = staff userId

### TC-C02: KH Tạo Kích Hoạt – 403
- **API**: `POST /activations` (Auth: customer JWT)
- **Input**: (same as above)
- **Kỳ Vọng**: 403, Forbidden

### TC-C03: ĐL Tạo Kích Hoạt – 403
- **API**: `POST /activations` (Auth: dealer JWT)
- **Input**: (same as above)
- **Kỳ Vọng**: 403, Forbidden

### TC-C04: QT Tạo Kích Hoạt – Thành Công
- **API**: `POST /activations` (Auth: admin JWT)
- **Kỳ Vọng**: 200 (cùng luồng như NV)

### TC-C05: Kích Hoạt Barcode Đã Kích Hoạt – 409
- **API**: `POST /activations` (Auth: staff JWT)
- **Input**: barcode đã `activated=true`
- **Kỳ Vọng**: 409, `"Barcode đã kích hoạt"`

### TC-C06: Kích Hoạt Barcode Không Tồn Tại – 400
- **API**: `POST /activations` (Auth: staff JWT)
- **Input**: `{ "barcode": "0000000000", ... }`
- **Kỳ Vọng**: 400, `"Barcode không tồn tại"`

### TC-C07: GET /activations – Chỉ NV/QT Truy Cập
- **API**: `GET /activations` (Auth: staff JWT)
- **Kỳ Vọng**: 200, danh sách activations
- **Kiểm Tra Thêm**: KH JWT → 403, ĐL JWT → 403

---

## D) Endpoint Tự Phục Vụ /me

### TC-D01: KH Xem Profile
- **API**: `GET /me` (Auth: customer JWT)
- **Kỳ Vọng**: 200, body chứa `customer.name`, `customer.points`

### TC-D02: ĐL Xem Profile
- **API**: `GET /me` (Auth: dealer JWT)
- **Kỳ Vọng**: 200, body chứa `dealer.name`, `dealer.shopName`, `dealer.dealerCode`, `dealer.points`

### TC-D03: NV Xem Profile
- **API**: `GET /me` (Auth: staff JWT)
- **Kỳ Vọng**: 200, body chứa `fullName`, `role: "STAFF"`

### TC-D04: KH Xem Lịch Sử Kích Hoạt
- **API**: `GET /me/activations?skip=0&take=10` (Auth: customer JWT)
- **Kỳ Vọng**: 200, `data[]` chỉ chứa activations của KH này

### TC-D05: ĐL Xem Thống Kê
- **API**: `GET /me/dealer/stats` (Auth: dealer JWT)
- **Kỳ Vọng**: 200, body chứa `totalActivations`, `activationsToday`, `uniqueCustomers`, `totalPoints`

### TC-D06: ĐL Xem Danh Sách Kích Hoạt
- **API**: `GET /me/dealer/activations?skip=0&take=10` (Auth: dealer JWT)
- **Kỳ Vọng**: 200, activations chỉ thuộc ĐL này

### TC-D07: KH Gọi /me/dealer/stats → 403
- **API**: `GET /me/dealer/stats` (Auth: customer JWT)
- **Kỳ Vọng**: 403, Forbidden

### TC-D08: NV Gọi /me/activations → 403
- **API**: `GET /me/activations` (Auth: staff JWT)
- **Kỳ Vọng**: 403 (endpoint chỉ cho KH)

---

## E) Luồng ZMP UI

### TC-E01: Màn Hình Login – Chọn KH → OTP Flow
1. Mở `/login`
2. Bấm chip "Khách hàng"
3. Nhập SĐT → Gửi OTP → Nhập mã → Xác nhận
4. **Kỳ Vọng**: Navigate tới `/customer-history`

### TC-E02: Login – Chọn NV → Password Flow
1. Mở `/login`
2. Bấm chip "Nhân viên"
3. Form chuyển sang input: Tên đăng nhập + Mật khẩu
4. Nhập staff01/staff123 → Đăng nhập
5. **Kỳ Vọng**: Navigate tới `/staff-home`

### TC-E03: NV Home – 2 Nút
1. Login NV → `/staff-home`
2. Kiểm tra có 2 nút: "Tích điểm", "Quản lý Barcode"
3. Bấm "Tích điểm" → Navigate `/earn-points`
4. Quay lại, bấm "Quản lý Barcode" → Navigate `/barcode-manage`

### TC-E04: QT Home – 3 Nút + Link
1. Login QT → `/admin-home`
2. Kiểm tra có "Tích điểm", "Quản lý Barcode", card Dashboard
3. Bấm "Dashboard Web" → mở link `http://localhost:5174`

### TC-E05: Quán Lý Barcode – Quét Camera
1. NV vào `/barcode-manage`
2. Bấm "Quét Camera"
3. Camera mở → quét barcode → giá trị tự điền vào ô input
4. Chọn sản phẩm (dropdown) → bấm "Thêm Barcode"
5. **Kỳ Vọng**: Thông báo thành công + barcode xuất hiện trong danh sách

### TC-E06: Quản Lý Barcode – Nhập Thủ Công
1. Bấm vào ô "Mã barcode" → nhập "8936999099"
2. Chọn sản phẩm → bấm "Thêm Barcode"
3. **Kỳ Vọng**: Thông báo thành công

### TC-E07: Quản Lý Barcode – Duplicate → Hiện Lỗi
1. Thêm barcode "8936000001" (đã tồn tại)
2. **Kỳ Vọng**: Thông báo đỏ "Barcode đã tồn tại"

### TC-E08: Quản Lý Barcode – Lọc Danh Sách
1. Trong danh sách barcode, chọn filter "Chưa dùng" (UNUSED)
2. **Kỳ Vọng**: Chỉ hiện barcode status=UNUSED
3. Nhập search "993"
4. **Kỳ Vọng**: Filter theo barcode contains "993"

### TC-E09: Lịch Sử KH – Chỉ Xem Không Tạo
1. Login KH → `/customer-history`
2. Kiểm tra không có nút "Tạo kích hoạt" hay "Quét barcode"
3. Chỉ hiện danh sách lịch sử của chính mình

### TC-E10: Dashboard ĐL – Chỉ Xem Không Tạo
1. Login ĐL → `/dealer-dashboard`
2. Kiểm tra không có nút "Tạo kích hoạt"
3. Chỉ hiện thống kê + danh sách kích hoạt của ĐL

---

## F) Regression Tests

### TC-F01: Tra Cứu Đại Lý – Không Cần Login
- Nhập "DL001" → tìm thấy "Cửa hàng An Khang"

### TC-F02: Quét Barcode → Tích Điểm Flow (NV)
1. NV login
2. Vào "Tích điểm" → nhập mã ĐL → quét barcode → nhập KH
3. **Kỳ Vọng**: Thành công, hiển thị kết quả

### TC-F03: Token Hết Hạn → Làm Mới Tự Động
1. Dùng app cho đến khi accessToken hết hạn (15 phút mock)
2. Gọi API → interceptor tự refresh → request thành công

### TC-F04: Admin Dashboard Web – CRUD Hoạt Động
1. Mở `http://localhost:5174`
2. Login admin
3. Xem/tạo/sửa/xóa đại lý, sản phẩm, khách hàng, kích hoạt
