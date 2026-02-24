# Kiến trúc Hệ thống Tích điểm Natri (v3)

## 1) Tổng quan nâng cấp

### Thay đổi chính so với v2:
- **Login 4 role** trong ZMP: CUSTOMER, DEALER (OTP), STAFF, ADMIN (username/password)
- **RBAC nâng cấp**: CUSTOMER/DEALER chỉ xem; STAFF tạo activation + quản lý barcode; ADMIN full
- **Barcode Management**: STAFF/ADMIN quét camera hoặc nhập thủ công → thêm barcode vào hệ thống
- **BarcodeItem**: thêm `status` (UNUSED/USED), `createdById`, `usedById` để track ai thêm/dùng
- **Dealer self-service**: chuyển từ `/dealer/me/*` sang `/me/dealer/*` thống nhất
- **Staff Home**: 2 tính năng: Tích điểm + Quản lý Barcode
- **Admin Home**: link đến Dashboard web + quản trị trong ZMP

## 2) DB Schema Prisma

### Sơ đồ ER (tóm tắt)
```
User (staff/admin) ──────── 1:N ──── Activation
     │                                 │
     │ 1:N BarcodesCreated             │ N:1
     │ 1:N BarcodesUsed                │
     │                                 ▼
     ▼                           BarcodeItem ──── N:1 ──── Product
UserAccount ──── 1:1 ──── Customer ──── 1:N ──── Activation
     │                                            │
     │           1:1 ──── Dealer ──── 1:N ────────┘
     │
     └──── 1:N ──── RefreshToken
```

### Bảng mới/cập nhật:

#### BarcodeItem (cập nhật)
| Field       | Type           | Mô tả                        |
|-------------|----------------|-------------------------------|
| id          | UUID PK        |                               |
| barcode     | VARCHAR(100) UQ| Mã barcode duy nhất           |
| productId   | UUID FK        | → Product                     |
| status      | UNUSED/USED    | Trạng thái barcode            |
| activated   | Boolean        | Đã kích hoạt?                 |
| activatedAt | DateTime?      | Thời điểm kích hoạt           |
| createdById | UUID? FK       | → User (staff/admin đã thêm)  |
| usedById    | UUID? FK       | → User (staff đã dùng khi activation) |
| createdAt   | DateTime       |                               |

#### User (cập nhật)
- Thêm relation: `barcodesCreated`, `barcodesUsed`

### Các bảng giữ nguyên từ v2:
- User, UserAccount, RefreshToken, OtpCode, Dealer, Product, Customer, Activation, AuditLog

## 3) API Spec

### 3.1) Auth (4 role)

| Endpoint | Method | Role | Mô tả |
|----------|--------|------|--------|
| `/auth/login` | POST | Staff/Admin | Username + password login |
| `/auth/otp/request` | POST | Public | Gửi OTP đến SĐT |
| `/auth/otp/verify` | POST | Public | Xác thực OTP → login |
| `/auth/refresh` | POST | Any | Refresh access token |
| `/auth/logout` | POST | Any | Revoke refresh token |

**POST /auth/login**
```json
// Request
{ "username": "admin", "password": "admin123" }
// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "a1b2c3...",
  "user": { "id": "u1", "username": "admin", "fullName": "Admin Natri", "role": "ADMIN" }
}
// Error 401: { "message": "Invalid credentials" }
```

**POST /auth/otp/request**
```json
// Request
{ "phone": "0351234567" }
// Response 200
{ "message": "OTP sent", "expiresIn": 300 }
// Error 400: { "message": "Invalid Vietnamese phone number" }
```

**POST /auth/otp/verify**
```json
// Request
{ "phone": "0351234567", "code": "123456", "role": "CUSTOMER" }
// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "a1b2c3...",
  "user": {
    "id": "ua_1",
    "phone": "0351234567",
    "role": "CUSTOMER",
    "customerId": "c1",
    "customer": { "id": "c1", "name": "Nguyễn Thị Hồng", "phone": "0351234567", "points": 3 }
  }
}
// Error 401: { "message": "Invalid or expired OTP" }
// Error 400: { "message": "No dealer found with this phone number" } (khi role=DEALER nhưng phone không khớp)
```

**POST /auth/refresh**
```json
// Request
{ "refreshToken": "a1b2c3..." }
// Response 200
{ "accessToken": "eyJ_new...", "refreshToken": "d4e5f6..." }
// Error 401: { "message": "Invalid or expired refresh token" }
```

### 3.2) Me endpoints

| Endpoint | Method | Role | Mô tả |
|----------|--------|------|--------|
| `/me` | GET | Any authenticated | Profile theo role |
| `/me/activations` | GET | CUSTOMER | Lịch sử kích hoạt KH |
| `/me/dealer/stats` | GET | DEALER | Thống kê đại lý |
| `/me/dealer/activations` | GET | DEALER | Danh sách kích hoạt qua đại lý |

**GET /me/activations?skip=0&take=10&search=Natri&dateFrom=2025-01-01**
```json
// Response 200 (CUSTOMER)
{
  "data": [
    {
      "id": "act1",
      "pointsAwarded": 1,
      "createdAt": "2025-02-20T10:00:00Z",
      "product": { "name": "Natri Ion 500ml", "sku": "P001" },
      "dealer": { "code": "DL001", "name": "Nguyễn Văn An", "shopName": "Cửa hàng An Khang" },
      "barcodeItem": { "barcode": "8936000001" }
    }
  ],
  "total": 5,
  "skip": 0,
  "take": 10
}
```

**GET /me/dealer/stats?from=2025-01-01&to=2025-02-28**
```json
// Response 200 (DEALER)
{
  "dealer": { "points": 15, "code": "DL001", "name": "Nguyễn Văn An", "shopName": "Cửa hàng An Khang" },
  "totalActivations": 42,
  "activationsToday": 3,
  "activationsWeek": 8,
  "activationsMonth": 25,
  "uniqueCustomers": 18,
  "totalPoints": 15
}
```

### 3.3) Barcode Management (STAFF/ADMIN)

| Endpoint | Method | Role | Mô tả |
|----------|--------|------|--------|
| `/barcodes` | POST | STAFF, ADMIN | Thêm 1 barcode |
| `/barcodes/batch` | POST | STAFF, ADMIN | Thêm nhiều barcode |
| `/barcodes` | GET | STAFF, ADMIN | Danh sách barcode |

**POST /barcodes**
```json
// Request
{ "code": "8936000051", "productSku": "P001" }
// Response 201
{
  "id": "bc_1",
  "barcode": "8936000051",
  "product": { "name": "Natri Ion 500ml", "sku": "P001" },
  "createdBy": { "username": "staff01", "fullName": "Nhân viên 01" }
}
// Error 409: { "statusCode": 409, "error": "BARCODE_ALREADY_EXISTS", "message": "Barcode \"8936000051\" already exists" }
// Error 404: { "message": "Product with SKU \"PXXX\" not found" }
// Error 403: CUSTOMER/DEALER gọi → Forbidden
```

**POST /barcodes/batch**
```json
// Request
{
  "items": [
    { "code": "8936000051", "productSku": "P001" },
    { "code": "8936000052", "productSku": "P002" },
    { "code": "8936000051", "productSku": "P001" }
  ]
}
// Response 200
{
  "total": 3,
  "created": 2,
  "errors": 1,
  "details": [
    { "code": "8936000051", "status": "created" },
    { "code": "8936000052", "status": "created" },
    { "code": "8936000051", "status": "error", "error": "Barcode \"8936000051\" already exists" }
  ]
}
```

**GET /barcodes?sku=P001&status=UNUSED&q=8936&skip=0&take=50**
```json
// Response 200
{
  "data": [
    {
      "id": "bc_1",
      "barcode": "8936000051",
      "status": "UNUSED",
      "activated": false,
      "activatedAt": null,
      "createdAt": "2025-02-20T09:00:00Z",
      "product": { "name": "Natri Ion 500ml", "sku": "P001" },
      "createdBy": { "username": "staff01", "fullName": "Nhân viên 01" }
    }
  ],
  "total": 30,
  "skip": 0,
  "take": 50
}
```

### 3.4) Activations (STAFF/ADMIN only)

| Endpoint | Method | Role | Mô tả |
|----------|--------|------|--------|
| `/activations` | POST | STAFF, ADMIN | Tạo kích hoạt (tích điểm) |
| `/activations` | GET | STAFF, ADMIN | Danh sách kích hoạt |
| `/activations/stats` | GET | ADMIN | Thống kê tổng |

**POST /activations**
```json
// Request
{
  "barcode": "8936000021",
  "customer": { "name": "Nguyễn Thị Hồng", "phone": "0351234567" },
  "dealerCode": "DL001"
}
// Response 200
{
  "activationId": "act_1",
  "product": { "id": "p1", "name": "Natri Ion 500ml", "sku": "P001" },
  "customerPointsAfter": 4,
  "dealerPointsAfter": 6
}
// Error 409: Barcode đã kích hoạt
// Error 400: Barcode không tồn tại
// Error 403: CUSTOMER/DEALER gọi → Forbidden
```

### 3.5) CRUD Admin

| Endpoint | Method | Role | Mô tả |
|----------|--------|------|--------|
| `/products` | GET | ADMIN | Danh sách sản phẩm |
| `/products` | POST | ADMIN | Tạo sản phẩm |
| `/dealers/lookup` | GET | Public | Tra cứu đại lý theo code |
| `/dealers` | GET/POST | ADMIN | CRUD đại lý |
| `/customers` | GET | ADMIN | Danh sách KH |

## 4) RBAC Matrix

| Resource / Action | CUSTOMER | DEALER | STAFF | ADMIN |
|---|---|---|---|---|
| POST /auth/login (password) | ✗ | ✗ | ✓ | ✓ |
| POST /auth/otp/* (OTP) | ✓ | ✓ | ✗ | ✗ |
| GET /me (profile) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) |
| GET /me/activations | ✓ (own) | ✗ | ✗ | ✗ |
| GET /me/dealer/stats | ✗ | ✓ (own) | ✗ | ✗ |
| GET /me/dealer/activations | ✗ | ✓ (own) | ✗ | ✗ |
| POST /activations (tích điểm) | **✗** | **✗** | ✓ | ✓ |
| GET /activations | ✗ | ✗ | ✓ | ✓ |
| GET /activations/stats | ✗ | ✗ | ✗ | ✓ |
| POST /barcodes (thêm barcode) | **✗** | **✗** | ✓ | ✓ |
| POST /barcodes/batch | **✗** | **✗** | ✓ | ✓ |
| GET /barcodes | ✗ | ✗ | ✓ | ✓ |
| GET /products | ✗ | ✗ | ✓ (read) | ✓ |
| POST /products | ✗ | ✗ | ✗ | ✓ |
| GET /dealers (admin list) | ✗ | ✗ | ✓ (read) | ✓ |
| GET /dealers/lookup (public) | ✓ | ✓ | ✓ | ✓ |
| CRUD /customers | ✗ | ✗ | ✗ | ✓ |

### Enforcement:
1. **JwtAuthGuard**: Xác thực JWT token
2. **RolesGuard** + **@Roles()**: Kiểm tra role trong JWT payload
3. **OwnershipGuard** + **@CheckOwnership()**: So sánh `req.user.customerId/dealerId` với resource; ADMIN/STAFF bypass

## 5) UI Flow ZMP

### Routes:
| Path | Component | Role | Mô tả |
|------|-----------|------|--------|
| `/` | DealerLookupPage | Any | Nhập mã đại lý + nút đăng nhập |
| `/earn-points` | EarnPointsPage | Any (STAFF/ADMIN tạo activation) | Quét barcode + nhập KH |
| `/result` | ResultPage | Any | Kết quả tích điểm |
| `/login` | LoginPage | Public | Đăng nhập 4 role |
| `/customer-history` | CustomerHistoryPage | CUSTOMER | Lịch sử tích điểm |
| `/dealer-dashboard` | DealerDashboardPage | DEALER | Thống kê đại lý |
| `/staff-home` | StaffHomePage | STAFF | Menu: Tích điểm + Quản lý Barcode |
| `/admin-home` | AdminHomePage | ADMIN | Menu quản trị + link Dashboard web |
| `/barcode-manage` | BarcodeManagePage | STAFF, ADMIN | Quét/thêm barcode + danh sách |

### Luồng màn hình:

```
DealerLookupPage (/)
├── [Đăng nhập] → LoginPage
│   ├── Chọn CUSTOMER/DEALER → OTP flow → success
│   │   ├── CUSTOMER → /customer-history
│   │   └── DEALER → /dealer-dashboard
│   └── Chọn STAFF/ADMIN → Password flow → success
│       ├── STAFF → /staff-home
│       │   ├── "Tích điểm" → /earn-points
│       │   └── "Quản lý Barcode" → /barcode-manage
│       └── ADMIN → /admin-home
│           ├── "Tích điểm" → /earn-points
│           ├── "Quản lý Barcode" → /barcode-manage
│           └── "Dashboard Web" → external link
└── [Tiếp tục] → /earn-points → /result
```

### Barcode Management UX States:

| State | UI |
|-------|-----|
| Loading | Spinner component |
| Empty list | "Chưa có barcode nào" + hướng dẫn |
| Scan success | Barcode value tự điền vào input |
| Scan unavailable | Fallback nhập thủ công |
| Duplicate barcode (409) | Thông báo đỏ "Barcode đã tồn tại" |
| Product not found (404) | Thông báo đỏ "Sản phẩm không tồn tại" |
| Forbidden (403) | Thông báo đỏ "Không có quyền" |
| Network error | Thông báo đỏ "Lỗi hệ thống" |
| Add success | Thông báo xanh + refresh danh sách |

## 6) Mock Data

### Tài khoản mẫu:
| Role | Phương thức | Thông tin |
|------|------------|-----------|
| ADMIN | Password | username: `admin`, password: `admin123` |
| STAFF | Password | username: `staff01`, password: `staff123` |
| CUSTOMER | OTP | phone: `0351234567`, OTP mock: `123456` |
| DEALER | OTP | phone: `0901234567` (DL001), OTP mock: `123456` |

### Dữ liệu mock:
- 5 Dealers (DL001-DL005)
- 5 Products (P001-P005)
- 50 Barcodes (8936000001-8936000050), 20 đầu đã USED
- 10 Customers
- 20 Activations (seeded)
- 5 UserAccount dealers + 10 UserAccount customers

## 7) Audit Log

Mỗi action quan trọng được ghi vào `audit_logs`:
- `LOGIN` — staff/admin login, OTP verify
- `OTP_REQUESTED` — yêu cầu OTP
- `ACTIVATION_CREATED` — tạo kích hoạt (với barcode, customer, dealer info)
- `BARCODE_CREATED` — thêm barcode vào hệ thống (ai thêm, product nào)

Metadata JSON chứa: actor, target, payload chi tiết.
