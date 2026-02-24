# Hệ thống Tích điểm Zalo Mini App - Kiến trúc tổng thể (v2)

## A) Kiến trúc hệ thống

```
┌───────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  Zalo Mini App        │    │   Admin Dashboard    │    │     PostgreSQL       │
│  (React + zmp-ui)     │    │  (React + AntDesign) │    │     Database         │
│                       │    │                      │    │                      │
│  - Dealer Lookup      │    │  - Overview          │    │  - users             │
│  - Login (OTP)        │    │  - Dealers CRUD      │    │  - user_accounts     │
│  - Earn Points        │    │  - Products/Barcodes │    │  - dealers           │
│  - Result             │    │  - Customers         │    │  - products          │
│  - Customer History   │    │  - Activations       │    │  - barcode_items     │
│  - Dealer Dashboard   │    │  - Users CRUD        │    │  - customers         │
│                       │    │                      │    │  - activations       │
└────────┬──────────────┘    └──────────┬───────────┘    │  - audit_logs        │
         │                              │                │  - otp_codes         │
         │  REST API                    │ REST API       │  - refresh_tokens    │
         │         ┌────────────────────┘                └──────────┬───────────┘
         ▼         ▼                                               │
    ┌──────────────────────────┐                                   │
    │   Backend (NestJS)       │───────────────────────────────────┘
    │   Node.js + TypeScript   │        Prisma ORM
    │                          │
    │  Modules:                │
    │  - AuthModule (JWT+OTP)  │
    │  - DealerModule          │
    │  - ProductModule         │
    │  - CustomerModule        │
    │  - ActivationModule      │
    │  - MeModule              │
    │  - DealerMeModule        │
    └──────────────────────────┘
```

## B) Hệ thống xác thực (Authentication)

### B.1) 4 vai trò (Roles)

| Role     | Mô tả                  | Phương thức đăng nhập | Đối tượng liên kết   |
|----------|-------------------------|-----------------------|----------------------|
| ADMIN    | Quản trị hệ thống      | Username + Password   | `users` table        |
| STAFF    | Nhân viên thực địa     | Username + Password   | `users` table        |
| DEALER   | Đại lý bán hàng        | Phone + OTP           | `user_accounts` → `dealers` |
| CUSTOMER | Khách hàng cuối        | Phone + OTP           | `user_accounts` → `customers` |

### B.2) Luồng xác thực OTP (Customer / Dealer)

```
1. POST /api/auth/otp/request   { phone: "0901234567" }
   → Server tạo OTP 6 số, lưu vào otp_codes, gửi SMS
   ← { message: "OTP sent", expiresIn: 300 }

2. POST /api/auth/otp/verify    { phone: "0901234567", code: "123456", role: "CUSTOMER" }
   → Xác minh OTP, tạo/tìm UserAccount, liên kết customer/dealer
   ← { accessToken, refreshToken, user: { id, phone, role, customerId, customer } }
```

### B.3) Refresh Token

```
POST /api/auth/refresh    { refreshToken: "..." }
→ Xác minh token, rotate (revoke cũ → tạo mới)
← { accessToken, refreshToken }

POST /api/auth/logout     { refreshToken: "..." }
→ Revoke refresh token
← { message: "Logged out" }
```

### B.4) JWT Payload

```json
{
  "sub": "user-id or userAccount-id",
  "username": "admin",          // chỉ ADMIN/STAFF
  "phone": "0901234567",        // chỉ CUSTOMER/DEALER
  "role": "CUSTOMER",
  "customerId": "customer-uuid", // chỉ CUSTOMER
  "dealerId": "dealer-uuid"      // chỉ DEALER
}
```

## C) RBAC Matrix (Quyền truy cập)

| Endpoint                     | ADMIN | STAFF | DEALER | CUSTOMER | Public |
|------------------------------|:-----:|:-----:|:------:|:--------:|:------:|
| `POST /auth/login`           |   -   |   -   |   -    |    -     |   ✅   |
| `POST /auth/otp/request`     |   -   |   -   |   -    |    -     |   ✅   |
| `POST /auth/otp/verify`      |   -   |   -   |   -    |    -     |   ✅   |
| `POST /auth/refresh`         |   -   |   -   |   -    |    -     |   ✅   |
| `POST /auth/logout`          |   -   |   -   |   -    |    -     |   ✅   |
| `GET /auth/me`               |  ✅   |  ✅   |   ✅   |   ✅     |   ❌   |
| `GET /dealers/lookup`        |   -   |   -   |   -    |    -     |   ✅   |
| `GET /dealers`               |  ✅   |  ❌   |   ❌   |   ❌     |   ❌   |
| `POST /dealers`              |  ✅   |  ❌   |   ❌   |   ❌     |   ❌   |
| `PUT /dealers/:id`           |  ✅   |  ❌   |   ❌   |   ❌     |   ❌   |
| `DELETE /dealers/:id`        |  ✅   |  ❌   |   ❌   |   ❌     |   ❌   |
| `GET /products/by-barcode/*` |   -   |   -   |   -    |    -     |   ✅   |
| `POST /activations`         |  ✅   |  ✅   |   ✅   |   ✅     |   ❌   |
| `GET /activations`          |  ✅   |  ✅   |   ❌   |   ❌     |   ❌   |
| `GET /activations/stats`    |  ✅   |  ❌   |   ❌   |   ❌     |   ❌   |
| `GET /me`                    |  ✅   |  ✅   |   ✅   |   ✅     |   ❌   |
| `GET /me/activations`        |  ❌   |  ❌   |   ❌   |   ✅¹    |   ❌   |
| `GET /dealer/me`             |  ❌   |  ❌   |   ✅²  |   ❌     |   ❌   |
| `GET /dealer/me/stats`       |  ❌   |  ❌   |   ✅²  |   ❌     |   ❌   |
| `GET /dealer/me/activations` |  ❌   |  ❌   |   ✅²  |   ❌     |   ❌   |
| `GET /customers`             |  ✅   |  ✅   |   ❌   |   ❌     |   ❌   |
| `GET /customers/by-phone/*`  |   -   |   -   |   -    |    -     |   ✅   |

> ¹ Ownership: chỉ xem dữ liệu của chính mình (customerId)  
> ² Ownership: chỉ xem dữ liệu của chính mình (dealerId)

## D) Database Schema (v2)

### Bảng mới

#### `user_accounts` — Tài khoản OTP cho Customer/Dealer
| Column     | Type        | Constraint         |
|------------|-------------|--------------------|
| id         | UUID        | PK                 |
| phone      | VARCHAR(15) | UNIQUE             |
| role       | ENUM        | CUSTOMER / DEALER  |
| customerId | UUID?       | UNIQUE, FK → customers |
| dealerId   | UUID?       | UNIQUE, FK → dealers   |
| active     | BOOLEAN     | DEFAULT true       |
| createdAt  | TIMESTAMP   |                    |
| updatedAt  | TIMESTAMP   |                    |

#### `refresh_tokens`
| Column        | Type         | Constraint              |
|---------------|-------------|-------------------------|
| id            | UUID        | PK                      |
| token         | VARCHAR(500)| UNIQUE                  |
| userAccountId | UUID?       | FK → user_accounts      |
| userId        | UUID?       | FK → users (staff/admin)|
| expiresAt     | TIMESTAMP   |                         |
| revoked       | BOOLEAN     | DEFAULT false           |
| createdAt     | TIMESTAMP   |                         |

#### `otp_codes`
| Column    | Type        | Constraint |
|-----------|-------------|------------|
| id        | UUID        | PK         |
| phone     | VARCHAR(15) |            |
| code      | VARCHAR(6)  |            |
| expiresAt | TIMESTAMP   |            |
| used      | BOOLEAN     | DEFAULT false |
| createdAt | TIMESTAMP   |            |

### Thay đổi trên bảng cũ

- `activations.staffId`: thay đổi từ **bắt buộc** → **optional** (cho phép customer/dealer tự kích hoạt)
- `activations` indexes: thêm composite `[customerId, createdAt]` và `[dealerId, createdAt]`
- `audit_logs`: thêm index `[userId]`

## E) Luồng xử lý chính

### E.1) Luồng đăng nhập Customer

```
1. Mở app → Trang Dealer Lookup → Nhấn "Đăng nhập"
2. Chọn Vai trò = "Khách hàng", Nhập SĐT → Gửi OTP
3. Nhập mã OTP 6 số → Xác nhận
4. Chuyển đến trang Lịch sử tích điểm
5. Xem danh sách sản phẩm đã kích hoạt + lọc theo thời gian/từ khóa
```

### E.2) Luồng đăng nhập Dealer

```
1. Mở app → Trang Dealer Lookup → Nhấn "Đăng nhập"
2. Chọn Vai trò = "Đại lý", Nhập SĐT → Gửi OTP
3. Nhập mã OTP 6 số → Xác nhận
4. Chuyển đến Dealer Dashboard
5. Xem thống kê: điểm, kích hoạt hôm nay/tuần/tháng, khách hàng duy nhất
6. Xem danh sách kích hoạt + tìm kiếm
```

### E.3) Luồng tích điểm (không thay đổi)

```
1. Trang Dealer Lookup → nhập mã đại lý (tùy chọn) → Tiếp tục
2. Trang Earn Points → quét/nhập barcode + thông tin khách hàng → Gửi
3. Trang Result → hiển thị kết quả tích điểm
```

## F) API Endpoints mới (v2)

### Auth
```
POST /api/auth/login           # Staff/Admin: username + password
POST /api/auth/otp/request     # Customer/Dealer: yêu cầu OTP
POST /api/auth/otp/verify      # Customer/Dealer: xác minh OTP
POST /api/auth/refresh         # Làm mới access token
POST /api/auth/logout          # Hủy refresh token
GET  /api/auth/me              # Thông tin user hiện tại
```

### Customer self-service
```
GET /api/me                    # Profile + role
GET /api/me/activations        # Lịch sử kích hoạt (filter: skip, take, dateFrom, dateTo, search)
```

### Dealer self-service
```
GET /api/dealer/me             # Profile đại lý
GET /api/dealer/me/stats       # Thống kê dashboard
GET /api/dealer/me/activations # Danh sách kích hoạt (filter)
```

## G) Frontend ZMP Pages (v2)

| Route               | Trang              | Mô tả                                      |
|----------------------|--------------------|---------------------------------------------|
| `/`                  | Dealer Lookup      | Nhập mã đại lý + nút Đăng nhập             |
| `/login`             | Login              | Đăng nhập OTP (chọn vai trò, nhập SĐT, OTP)|
| `/earn-points`       | Earn Points        | Quét barcode + thông tin KH                 |
| `/result`            | Result             | Kết quả tích điểm                           |
| `/customer-history`  | Customer History   | Lịch sử tích điểm KH (lọc, phân trang)     |
| `/dealer-dashboard`  | Dealer Dashboard   | Dashboard đại lý (thống kê + danh sách)     |

## H) Mock Data (v2)

### OTP mặc định trong mock mode
- Mã OTP luôn là: `123456`
- Hết hạn sau 5 phút

### Tài khoản mẫu

| Vai trò  | Thông tin đăng nhập         | Ghi chú              |
|----------|-----------------------------|----------------------|
| ADMIN    | admin / admin123            | Username + Password  |
| STAFF    | staff01 / staff123          | Username + Password  |
| CUSTOMER | 0351234567 + OTP 123456     | Nguyễn Thị Hồng      |
| DEALER   | 0901234567 + OTP 123456     | Đại lý DL001 - An Khang |
