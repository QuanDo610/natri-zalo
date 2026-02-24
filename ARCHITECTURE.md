# Kiến Trúc Hệ Thống Tích Điểm Natri (v3)

## 1) Tổng Quan Nâng Cấp

### Thay Đổi Chính So Với v2:
- **Đăng nhập 4 vai trò** trong ZMP: CUSTOMER (HĐ), DEALER (ĐL), STAFF (NV), ADMIN (QT)
- **RBAC nâng cấp**: HĐ/ĐL chỉ xem; NV tạo kích hoạt + quản lý barcode; QT full
- **Quản Lý Barcode**: NV/QT quét camera hoặc nhập thủ công → thêm barcode
- **BarcodeItem**: Thêm `status` (UNUSED/USED), `createdById`, `usedById` để theo dõi
- **Dealer self-service**: Chuyển từ `/dealer/me/*` sang `/me/dealer/*`
- **Staff Home**: 2 tính năng: Tích Điểm + Quản Lý Barcode
- **Admin Home**: Liên kết Dashboard web + quản trị trong ZMP

## 2) Schema Prisma DB

### Sơ Đồ ER (Tóm Tắt)
```
User (NV/QT) ────────── 1:N ──── Activation
     │                             │
     │ 1:N BarcodesCreated         │ N:1
     │ 1:N BarcodesUsed            │
     │                             ▼
     ▼                       BarcodeItem ──── N:1 ──── Product
UserAccount ──── 1:1 ──── Customer ──── 1:N ──── Activation
     │                                          │
     │           1:1 ──── Dealer ──── 1:N ────────┘
     │
     └──── 1:N ──── RefreshToken
```

### Bảng Mới/Cập Nhật:

#### BarcodeItem (cập nhật)
| Trường | Kiểu | Mô Tả |
|--------|------|-------|
| id | UUID PK | |
| barcode | VARCHAR(100) UQ | Mã barcode duy nhất |
| productId | UUID FK | → Product |
| status | UNUSED/USED | Trạng thái barcode |
| activated | Boolean | Đã kích hoạt? |
| activatedAt | DateTime? | Lúc kích hoạt |
| createdById | UUID? FK | → User (NV/QT thêm) |
| usedById | UUID? FK | → User (NV dùng lúc activation) |
| createdAt | DateTime | |

#### User (cập nhật)
- Thêm quan hệ: `barcodesCreated`, `barcodesUsed`

## 3) API Spec

### 3.1) Xác Thực (4 vai trò)

| Endpoint | Method | Vai trò | Mô Tả |
|----------|--------|--------|--------|
| `/auth/login` | POST | NV/QT | Đăng nhập username + password |
| `/auth/otp/request` | POST | Public | Gửi OTP đến SĐT |
| `/auth/otp/verify` | POST | Public | Xác thực OTP → login |
| `/auth/refresh` | POST | Bất kỳ | Làm mới access token |
| `/auth/logout` | POST | Bất kỳ | Hủy refresh token |

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
// Error 401: { "message": "Sai thông tin đăng nhập" }
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
// Error 401: { "message": "OTP không hợp lệ hoặc hết hạn" }
// Error 400: { "message": "Không tìm thấy đại lý" } (role=DEALER, phone không khớp)
```

### 3.2) Endpoints /me

| Endpoint | Method | Vai trò | Mô Tả |
|----------|--------|--------|--------|
| `/me` | GET | Bất kỳ | Profile theo vai trò |
| `/me/activations` | GET | KH | Lịch sử kích hoạt |
| `/me/dealer/stats` | GET | ĐL | Thống kê đại lý |
| `/me/dealer/activations` | GET | ĐL | Danh sách kích hoạt |

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

### 3.3) Quản Lý Barcode (NV/QT)

| Endpoint | Method | Vai trò | Mô Tả |
|----------|--------|--------|--------|
| `/barcodes` | POST | NV, QT | Thêm 1 barcode |
| `/barcodes/batch` | POST | NV, QT | Thêm nhiều barcode |
| `/barcodes` | GET | NV, QT | Danh sách barcode |

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
// Error 409: { "statusCode": 409, "error": "BARCODE_ALREADY_EXISTS", "message": "Barcode \"8936000051\" đã tồn tại" }
// Error 404: { "message": "Sản phẩm SKU \"PXXX\" không tồn tại" }
// Error 403: KH/ĐL gọi → Forbidden
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
    { "code": "8936000051", "status": "error", "error": "Barcode \"8936000051\" đã tồn tại" }
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

### 3.4) Activations (NV/QT)

| Endpoint | Method | Vai trò | Mô Tả |
|----------|--------|--------|--------|
| `/activations` | POST | NV, QT | Tạo kích hoạt (tích điểm) |
| `/activations` | GET | NV, QT | Danh sách kích hoạt |
| `/activations/stats` | GET | QT | Thống kê tổng |

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
// Error 403: KH/ĐL gọi → Forbidden
```

### 3.5) CRUD Quản Trị

| Endpoint | Method | Vai trò | Mô Tả |
|----------|--------|--------|--------|
| `/products` | GET | QT | Danh sách sản phẩm |
| `/products` | POST | QT | Tạo sản phẩm |
| `/dealers/lookup` | GET | Public | Tra cứu đại lý theo code |
| `/dealers` | GET/POST | QT | CRUD đại lý |
| `/customers` | GET | QT | Danh sách KH |

## 4) Ma Trận RBAC

| Resource / Hành Động | KH | ĐL | NV | QT |
|---|---|---|---|---|
| POST /auth/login (password) | ✗ | ✗ | ✓ | ✓ |
| POST /auth/otp/* (OTP) | ✓ | ✓ | ✗ | ✗ |
| GET /me (profile) | ✓ (riêng) | ✓ (riêng) | ✓ (riêng) | ✓ (riêng) |
| GET /me/activations | ✓ (riêng) | ✗ | ✗ | ✗ |
| GET /me/dealer/stats | ✗ | ✓ (riêng) | ✗ | ✗ |
| GET /me/dealer/activations | ✗ | ✓ (riêng) | ✗ | ✗ |
| POST /activations (tích điểm) | **✗** | **✗** | ✓ | ✓ |
| GET /activations | ✗ | ✗ | ✓ | ✓ |
| GET /activations/stats | ✗ | ✗ | ✗ | ✓ |
| POST /barcodes (thêm barcode) | **✗** | **✗** | ✓ | ✓ |
| POST /barcodes/batch | **✗** | **✗** | ✓ | ✓ |
| GET /barcodes | ✗ | ✗ | ✓ | ✓ |
| GET /products | ✗ | ✗ | ✓ (xem) | ✓ |
| POST /products | ✗ | ✗ | ✗ | ✓ |
| GET /dealers (admin list) | ✗ | ✗ | ✓ (xem) | ✓ |
| GET /dealers/lookup (public) | ✓ | ✓ | ✓ | ✓ |
| CRUD /customers | ✗ | ✗ | ✗ | ✓ |

### Cơ Chế Kiểm Soát:
1. **JwtAuthGuard**: Xác thực JWT token
2. **RolesGuard** + **@Roles()**: Kiểm tra vai trò trong JWT payload
3. **OwnershipGuard** + **@CheckOwnership()**: So sánh `req.user.customerId/dealerId` với resource; QT/NV bypass

## 5) ZMP UI Flow

### Routes:
| Path | Component | Vai trò | Mô Tả |
|------|-----------|--------|--------|
| `/` | DealerLookupPage | Bất kỳ | Nhập mã đại lý + nút đăng nhập |
| `/earn-points` | EarnPointsPage | Bất kỳ (NV/QT tạo activation) | Quét barcode + nhập KH |
| `/result` | ResultPage | Bất kỳ | Kết quả tích điểm |
| `/login` | LoginPage | Public | Đăng nhập 4 vai trò |
| `/customer-history` | CustomerHistoryPage | KH | Lịch sử tích điểm |
| `/dealer-dashboard` | DealerDashboardPage | ĐL | Thống kê đại lý |
| `/staff-home` | StaffHomePage | NV | Menu: Tích Điểm + Quản Lý Barcode |
| `/admin-home` | AdminHomePage | QT | Menu quản trị + link Dashboard web |
| `/barcode-manage` | BarcodeManagePage | NV, QT | Quét/thêm barcode + danh sách |

### Luồng Màn Hình:

```
DealerLookupPage (/)
├── [Đăng nhập] → LoginPage
│   ├── Chọn KH/ĐL → OTP flow → thành công
│   │   ├── KH → /customer-history
│   │   └── ĐL → /dealer-dashboard
│   └── Chọn NV/QT → Password flow → thành công
│       ├── NV → /staff-home
│       │   ├── "Tích điểm" → /earn-points
│       │   └── "Quản lý Barcode" → /barcode-manage
│       └── QT → /admin-home
│           ├── "Tích điểm" → /earn-points
│           ├── "Quản lý Barcode" → /barcode-manage
│           └── "Dashboard Web" → external link
└── [Tiếp tục] → /earn-points → /result
```

## 6) Dữ Liệu Mock

### Tài Khoản Mẫu:
| Vai Trò | Phương Thức | Thông Tin |
|---------|-----------|----------|
| ADMIN | Password | username: `admin`, password: `admin123` |
| STAFF | Password | username: `staff01`, password: `staff123` |
| CUSTOMER | OTP | phone: `0351234567`, OTP mock: `123456` |
| DEALER | OTP | phone: `0901234567` (DL001), OTP mock: `123456` |

### Dữ Liệu Mock:
- 5 Đại lý (DL001-DL005)
- 5 Sản phẩm (P001-P005)
- 50 Barcode (8936000001-8936000050), 20 đầu đã USED
- 10 Khách hàng
- 20 Kích hoạt (seeded)
- 5 UserAccount đại lý + 10 UserAccount khách hàng

## 7) Audit Log

Mỗi hành động quan trọng được ghi vào `audit_logs`:
- `LOGIN` — Đăng nhập NV/QT, xác thực OTP
- `OTP_REQUESTED` — Yêu cầu OTP
- `ACTIVATION_CREATED` — Tạo kích hoạt
- `BARCODE_CREATED` — Thêm barcode vào hệ thống
