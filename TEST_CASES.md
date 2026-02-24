# Test Cases – Hệ thống Tích điểm Natri v3

## A) Auth / OTP / Refresh Token

### TC-A01: OTP Request – CUSTOMER
- **API**: `POST /auth/otp/request`
- **Input**: `{ "phone": "0351234567" }`
- **Expected**: 200 `{ "message": "OTP sent", "expiresIn": 300 }`

### TC-A02: OTP Verify – CUSTOMER success
- **API**: `POST /auth/otp/verify`
- **Input**: `{ "phone": "0351234567", "code": "123456", "role": "CUSTOMER" }`
- **Expected**: 200, body chứa `accessToken`, `refreshToken`, `user.role === "CUSTOMER"`, `user.customerId !== null`

### TC-A03: OTP Verify – DEALER success
- **API**: `POST /auth/otp/verify`
- **Input**: `{ "phone": "0901234567", "code": "123456", "role": "DEALER" }`
- **Expected**: 200, `user.role === "DEALER"`, `user.dealerId !== null`

### TC-A04: OTP Verify – DEALER phone không khớp dealer nào
- **API**: `POST /auth/otp/verify`
- **Input**: `{ "phone": "0999999999", "code": "123456", "role": "DEALER" }`
- **Expected**: 400, `"No dealer found with this phone number"`

### TC-A05: OTP Verify – mã OTP sai
- **API**: `POST /auth/otp/verify`
- **Input**: `{ "phone": "0351234567", "code": "000000", "role": "CUSTOMER" }`
- **Expected**: 401, `"Invalid or expired OTP"`

### TC-A06: Staff login – password thành công
- **API**: `POST /auth/login`
- **Input**: `{ "username": "staff01", "password": "staff123" }`
- **Expected**: 200, `user.role === "STAFF"`, `accessToken`, `refreshToken` không null

### TC-A07: Admin login – password thành công
- **API**: `POST /auth/login`
- **Input**: `{ "username": "admin", "password": "admin123" }`
- **Expected**: 200, `user.role === "ADMIN"`

### TC-A08: Staff login – sai password
- **API**: `POST /auth/login`
- **Input**: `{ "username": "staff01", "password": "wrongpass" }`
- **Expected**: 401, `"Invalid credentials"`

### TC-A09: Refresh token – thành công
- **API**: `POST /auth/refresh`
- **Input**: `{ "refreshToken": "<valid>" }`
- **Expected**: 200, nhận accessToken mới + refreshToken mới (rotation)

### TC-A10: Refresh token – token đã revoke
- **API**: `POST /auth/refresh`
- **Input**: `{ "refreshToken": "<revoked>" }`
- **Expected**: 401, `"Invalid or expired refresh token"`

### TC-A11: Logout – revoke token
- **API**: `POST /auth/logout` (Auth header)
- **Input**: `{ "refreshToken": "<valid>" }`
- **Expected**: 200, sau đó refresh bằng token cũ → 401

---

## B) Barcode Management (STAFF/ADMIN)

### TC-B01: Staff thêm barcode – thành công
- **API**: `POST /barcodes` (Auth: staff01 JWT)
- **Input**: `{ "code": "8936999001", "productSku": "P001" }`
- **Expected**: 201, body chứa `barcode === "8936999001"`, `product.sku === "P001"`, `createdBy.username === "staff01"`
- **DB verify**: BarcodeItem record có `status: "UNUSED"`, `createdById` = staff01's userId

### TC-B02: Admin thêm barcode – thành công
- **API**: `POST /barcodes` (Auth: admin JWT)
- **Input**: `{ "code": "8936999002", "productSku": "P002" }`
- **Expected**: 201, `createdBy.username === "admin"`

### TC-B03: Thêm barcode trùng – 409
- **Precondition**: Barcode "8936000001" đã tồn tại
- **API**: `POST /barcodes` (Auth: staff)
- **Input**: `{ "code": "8936000001", "productSku": "P001" }`
- **Expected**: 409, `"error": "BARCODE_ALREADY_EXISTS"`, `"message"` chứa "8936000001"

### TC-B04: Thêm barcode – product SKU không tồn tại – 404
- **API**: `POST /barcodes` (Auth: staff)
- **Input**: `{ "code": "8936999003", "productSku": "PXXX" }`
- **Expected**: 404, `"Product with SKU \"PXXX\" not found"`

### TC-B05: CUSTOMER thêm barcode – 403
- **API**: `POST /barcodes` (Auth: customer JWT)
- **Input**: `{ "code": "8936999004", "productSku": "P001" }`
- **Expected**: 403, Forbidden

### TC-B06: DEALER thêm barcode – 403
- **API**: `POST /barcodes` (Auth: dealer JWT)
- **Input**: `{ "code": "8936999005", "productSku": "P001" }`
- **Expected**: 403, Forbidden

### TC-B07: Batch thêm barcode – mixed results
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
- **Expected**: 200, `total: 3`, `created: 1`, `errors: 2`
  - `details[0].status === "created"`
  - `details[1].status === "error"` (duplicate)
  - `details[2].status === "error"` (product not found)

### TC-B08: GET barcodes – filter by status UNUSED
- **API**: `GET /barcodes?status=UNUSED&take=5` (Auth: staff)
- **Expected**: 200, tất cả items có `status === "UNUSED"`

### TC-B09: GET barcodes – filter by sku + search
- **API**: `GET /barcodes?sku=P001&q=8936&skip=0&take=10` (Auth: admin)
- **Expected**: 200, items chỉ có `product.sku === "P001"`, barcode chứa "8936"

### TC-B10: GET barcodes – CUSTOMER → 403
- **API**: `GET /barcodes` (Auth: customer)
- **Expected**: 403, Forbidden

---

## C) Activations (STAFF/ADMIN only – v3 change)

### TC-C01: Staff tạo activation – thành công
- **API**: `POST /activations` (Auth: staff JWT)
- **Input**:
```json
{
  "barcode": "8936000021",
  "customer": { "name": "Nguyễn Thị Hồng", "phone": "0351234567" },
  "dealerCode": "DL001"
}
```
- **Expected**: 200, `product.name` not null, `customerPointsAfter >= 1`, `dealerPointsAfter >= 1`
- **DB verify**: BarcodeItem `activated=true`, `status="USED"`, `usedById` = staff userId

### TC-C02: CUSTOMER tạo activation – 403
- **API**: `POST /activations` (Auth: customer JWT)
- **Input**: (same as above)
- **Expected**: 403, Forbidden

### TC-C03: DEALER tạo activation – 403
- **API**: `POST /activations` (Auth: dealer JWT)
- **Input**: (same as above)
- **Expected**: 403, Forbidden

### TC-C04: Admin tạo activation – thành công
- **API**: `POST /activations` (Auth: admin JWT)
- **Expected**: 200 (same flow as staff)

### TC-C05: Activation barcode đã kích hoạt – 409
- **API**: `POST /activations` (Auth: staff JWT)
- **Input**: barcode đã `activated=true`
- **Expected**: 409, `"Barcode already activated"`

### TC-C06: Activation barcode không tồn tại – 400
- **API**: `POST /activations` (Auth: staff JWT)
- **Input**: `{ "barcode": "0000000000", ... }`
- **Expected**: 400, `"Barcode not found"`

### TC-C07: GET /activations – chỉ STAFF/ADMIN truy cập
- **API**: `GET /activations` (Auth: staff JWT)
- **Expected**: 200, danh sách activations
- **Also check**: customer JWT → 403, dealer JWT → 403

---

## D) Self-service /me endpoints

### TC-D01: CUSTOMER xem profile
- **API**: `GET /me` (Auth: customer JWT)
- **Expected**: 200, body chứa `customer.name`, `customer.points`

### TC-D02: DEALER xem profile
- **API**: `GET /me` (Auth: dealer JWT)
- **Expected**: 200, body chứa `dealer.name`, `dealer.shopName`, `dealer.dealerCode`, `dealer.points`

### TC-D03: STAFF xem profile
- **API**: `GET /me` (Auth: staff JWT)
- **Expected**: 200, body chứa `fullName`, `role: "STAFF"`

### TC-D04: CUSTOMER xem lịch sử kích hoạt
- **API**: `GET /me/activations?skip=0&take=10` (Auth: customer JWT)
- **Expected**: 200, `data[]` chỉ chứa activations của customer này

### TC-D05: DEALER xem thống kê
- **API**: `GET /me/dealer/stats` (Auth: dealer JWT)
- **Expected**: 200, body chứa `totalActivations`, `activationsToday`, `uniqueCustomers`, `totalPoints`

### TC-D06: DEALER xem danh sách activations
- **API**: `GET /me/dealer/activations?skip=0&take=10` (Auth: dealer JWT)
- **Expected**: 200, activations chỉ thuộc dealer này

### TC-D07: CUSTOMER gọi /me/dealer/stats → 403
- **API**: `GET /me/dealer/stats` (Auth: customer JWT)
- **Expected**: 403, Forbidden

### TC-D08: STAFF gọi /me/activations → 403
- **API**: `GET /me/activations` (Auth: staff JWT)
- **Expected**: 403 (endpoint chỉ cho CUSTOMER)

---

## E) ZMP UI Flows

### TC-E01: Login màn hình – chọn CUSTOMER → OTP flow
1. Mở `/login`
2. Bấm chip "Khách hàng"
3. Nhập SĐT → Gửi OTP → Nhập mã → Xác nhận
4. **Expected**: Navigate tới `/customer-history`

### TC-E02: Login – chọn STAFF → Password flow
1. Mở `/login`
2. Bấm chip "Nhân viên"
3. Form chuyển sang input: Tên đăng nhập + Mật khẩu
4. Nhập staff01/staff123 → Đăng nhập
5. **Expected**: Navigate tới `/staff-home`

### TC-E03: Staff Home – 2 nút
1. Login staff → `/staff-home`
2. Kiểm tra có 2 nút: "Tích điểm", "Quản lý Barcode"
3. Bấm "Tích điểm" → Navigate `/earn-points`
4. Quay lại, bấm "Quản lý Barcode" → Navigate `/barcode-manage`

### TC-E04: Admin Home – 3 nút + link
1. Login admin → `/admin-home`
2. Kiểm tra có "Tích điểm", "Quản lý Barcode", card Dashboard
3. Bấm "Dashboard Web" → mở link `http://localhost:5173`

### TC-E05: Barcode Manage – quét camera
1. Staff vào `/barcode-manage`
2. Bấm "Quét Camera"
3. Camera mở → quét barcode → giá trị tự điền vào ô input
4. Chọn sản phẩm (dropdown) → bấm "Thêm Barcode"
5. **Expected**: Thông báo thành công + barcode xuất hiện trong danh sách

### TC-E06: Barcode Manage – nhập thủ công
1. Bấm vào ô "Mã barcode" → nhập "8936999099"
2. Chọn sản phẩm → bấm "Thêm Barcode"
3. **Expected**: Thông báo thành công

### TC-E07: Barcode Manage – duplicate → hiện lỗi
1. Thêm barcode "8936000001" (đã tồn tại)
2. **Expected**: Thông báo đỏ "Barcode đã tồn tại"

### TC-E08: Barcode Manage – filter danh sách
1. Trong danh sách barcode, chọn filter "Chưa dùng" (UNUSED)
2. **Expected**: Chỉ hiện barcode status=UNUSED
3. Nhập search "993"
4. **Expected**: Filter theo barcode contains "993"

### TC-E09: Customer History – chỉ xem không tạo
1. Login customer → `/customer-history`
2. Kiểm tra không có nút "Tạo kích hoạt" hay "Quét barcode"
3. Chỉ hiện danh sách lịch sử kích hoạt của chính mình

### TC-E10: Dealer Dashboard – chỉ xem không tạo
1. Login dealer → `/dealer-dashboard`
2. Kiểm tra không có nút "Tạo kích hoạt"
3. Chỉ hiện thống kê + danh sách kích hoạt qua đại lý

---

## F) Regression Tests

### TC-F01: Dealer Lookup – tìm đại lý (không cần login)
- Nhập "DL001" → tìm thấy "Cửa hàng An Khang"

### TC-F02: Scan barcode → tích điểm flow (staff)
1. Staff login
2. Vào "Tích điểm" → nhập mã đại lý → quét barcode → nhập KH
3. **Expected**: Thành công, hiển thị kết quả

### TC-F03: Token expired → refresh tự động
1. Dùng app cho đến khi accessToken hết hạn (15 phút mock)
2. Gọi API → interceptor tự refresh → request thành công

### TC-F04: Admin Dashboard Web – CRUD hoạt động
1. Mở `http://localhost:5173`
2. Login admin
3. Xem/tạo/sửa/xóa dealers, products, customers, activations
