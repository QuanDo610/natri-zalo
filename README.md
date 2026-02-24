# Hệ Thống Tích Điểm Natri – Zalo Mini App

**Phiên bản**: v3 | **Trạng thái**: Sản xuất

Hệ thống quản lý tích điểm hoàn chỉnh cho nước uống Natri với xác thực 4 vai trò (Khách hàng, Đại lý, Nhân viên, Quản trị), quét barcode, và theo dõi điểm theo thời gian thực.

## 📋 Tổng Quan Dự Án

Hệ Thống Tích Điểm Natri là một hệ sinh thái kỹ thuật số hoàn chỉnh để quản lý khuyến mãi sản phẩm và tăng cường tương tác khách hàng:

- **Khách hàng**: Theo dõi điểm kiếm được qua mua hàng qua đại lý
- **Đại lý**: Giám sát hoạt động bán hàng, quản lý kích hoạt, theo dõi điểm hoa hồng
- **Nhân viên**: Quét barcode sản phẩm, tạo kích hoạt (trao điểm cho khách hàng)
- **Quản trị**: Kiểm soát toàn bộ hoạt động qua dashboard web

### Kiến Trúc Cơ Bản

```
┌─────────────────────────────────────────────────────────┐
│       HỆ THỐNG TÍCH ĐIỂM NATRI v3                      │
├──────────────────┬──────────────────┬──────────────────┤
│   ZMP Frontend   │   Backend API    │ Admin Dashboard  │
│   (React/TS)     │  (NestJS/Prisma) │  (React/Ant)     │
│   Port: 3000     │   Port: 3001     │   Port: 5174     │
│  Login 4 vai trò │   PostgreSQL     │   CRUD Đầy đủ    │
│  Quét Camera     │   RBAC 4 vai trò │   Báo cáo        │
└─────────────────┴──────────────────┴──────────────────┘
```

## 🚀 Bắt Đầu Nhanh

### Yêu Cầu Trước

- **Node.js** 18+ với npm
- **PostgreSQL** 13+ (chạy cục bộ hoặc Docker)
- **Zalo Mini App CLI** (chỉ để triển khai ZMP)

### 1️⃣ Cài Đặt Backend

```bash
cd backend
npm install --legacy-peer-deps
```

**Cấu hình Database** – Tạo `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/natri_loyalty"
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRATION=900
JWT_REFRESH_EXPIRATION=604800
OTP_EXPIRATION=300
PHONE_OTP_LENGTH=6
```

**Migrate & Seed Database**:
```bash
npx prisma migrate dev --name initial
npx prisma db seed
```

**Bật Backend** (port 3001):
```bash
npm run start:dev
```

### 2️⃣ Cài Đặt Zalo Mini App (ZMP)

```bash
cd .
npm install
```

**Bật ZMP** (port 3000):
```bash
zmp start
```

### 3️⃣ Cài Đặt Admin Dashboard

```bash
cd admin
npm install --legacy-peer-deps
```

**Bật Admin Dashboard** (port 5174):
```bash
npm run dev
```

---

## 🔐 Thông Tin Đăng Nhập Tester

### Frontend (ZMP) & Backend Login

| Vai trò | Phương thức | Username/SĐT | Mật khẩu/OTP |
|---------|-----------|---------|----------|
| **KHÁCH HÀNG** | OTP | 0351234567 | 123456 |
| **ĐẠI LÝ** | OTP | 0901234567 | 123456 |
| **NHÂN VIÊN** | Mật khẩu | staff01 | staff123 |
| **QUẢN TRỊ** | Mật khẩu | admin | admin123 |

**Tra cứu Đại lý**: Nhập mã `DL001` để tìm "Cửa hàng An Khang"

### Admin Dashboard

Dùng thông tin ADMIN trên (username: `admin`, password: `admin123`)

---

## 🏗️ Cấu Trúc Dự Án

```
natri-zalo/
├── backend/                          # NestJS API Server
│   ├── src/
│   │   ├── auth/                    # JWT, luồng OTP
│   │   ├── barcodes/                # Quản lý barcode
│   │   ├── activations/             # Logic tích điểm
│   │   ├── me/                      # Endpoint tự phục vụ
│   │   ├── products/                # Danh sách sản phẩm
│   │   ├── dealers/                 # Quản lý đại lý
│   │   ├── customers/               # Quản lý khách hàng
│   │   ├── guards/                  # Guard auth & RBAC
│   │   └── app.module.ts
│   ├── prisma/
│   │   ├── schema.prisma            # Schema DB (v3: BarcodeStatus)
│   │   └── seed.ts                  # Dữ liệu tester
│   └── package.json
│
├── src/                              # Zalo Mini App (ZMP)
│   ├── pages/
│   │   ├── login.tsx               # Đăng nhập 4 vai trò
│   │   ├── staff-home.tsx          # Menu nhân viên
│   │   ├── admin-home.tsx          # Menu quản trị
│   │   ├── barcode-manage.tsx      # Quét/thêm barcode
│   │   ├── customer-history.tsx    # Lịch sử KH
│   │   ├── dealer-dashboard.tsx    # Dashboard ĐL
│   │   └── [các trang khác]
│   ├── components/
│   │   ├── layout.tsx              # Định tuyến
│   │   ├── clock.tsx
│   │   └── logo.tsx
│   ├── services/
│   │   ├── api-client.ts           # Gọi API
│   │   ├── mock-service.ts         # Mock data
│   │   └── scanner.ts              # Camera/barcode
│   ├── types/
│   │   └── index.ts                # TypeScript interface
│   └── app.ts                       # Điểm vào
│
├── admin/                            # Admin Dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Dealers.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Activations.tsx
│   │   │   └── Barcodes.tsx
│   │   ├── components/
│   │   ├── services/                # Tích hợp API
│   │   ├── mock/
│   │   │   └── mockData.ts          # Dữ liệu mock
│   │   └── App.tsx
│   └── package.json
│
├── ARCHITECTURE.md                   # Thiết kế hệ thống v3
├── TEST_CASES.md                     # Test suite
├── FEATURES.md                       # Danh sách tính năng
├── package.json
├── tsconfig.json
└── README.md (file này)
```

---

## 🔄 Luồng Công Việc Chính

### 📱 Hành Trình Khách Hàng
```
Tra cứu Đại lý (nhập "DL001")
    ↓
Đăng nhập (OTP: 0351234567 + 123456)
    ↓
Lịch sử (xem điểm kiếm được)
```

### 🛒 Tích Điểm Nhân Viên
```
Đăng nhập NV (staff01 / staff123)
    ↓
Trang chủ NV ("Tích điểm")
    ↓
Quét barcode (hoặc nhập thủ công)
    ↓
Nhập SĐT + Chọn đại lý
    ↓
Xác nhận → Trao điểm ✓
```

### 📦 Quản Lý Barcode NV
```
Đăng nhập NV
    ↓
Trang chủ NV ("Quản lý Barcode")
    ↓
"Quét Camera" (quét barcode)
    HOẶC
Nhập thủ công
    ↓
Chọn sản phẩm (dropdown)
    ↓
"Thêm Barcode" → Thêm vào hệ thống ✓
    ↓
Xem danh sách gần đây (lọc theo SKU/trạng thái)
```

### 👨‍💼 Dashboard Đại Lý
```
Đăng nhập ĐL (OTP: 0901234567 + 123456)
    ↓
Dashboard ĐL
    ├── Thống kê (tổng bán, điểm, ngày/tuần/tháng)
    └── Kích hoạt (danh sách bán hàng)
```

### ⚙️ Kiểm Soát Quản Trị
```
Đăng nhập Admin (admin / admin123)
    ↓
Dashboard
    ├── Đại lý (CRUD)
    ├── Sản phẩm (CRUD)
    ├── Khách hàng (xem)
    ├── Kích hoạt (xem/xuất)
    └── Barcode (xem, nhập hàng loạt)
```

---

## 🔐 Ma Trận RBAC (v3)

| Hành động | KH | ĐL | NV | QT |
|-----------|-----|-----|-----|-----|
| Xem profile riêng | ✓ | ✓ | ✓ | ✓ |
| Xem kích hoạt riêng | ✓ | ✓ | ✗ | ✗ |
| Xem thống kê ĐL | ✗ | ✓ | ✗ | ✗ |
| **Tạo kích hoạt** | ✗ | ✗ | ✓ | ✓ |
| **Thêm barcode** | ✗ | ✗ | ✓ | ✓ |
| Xem tất cả kích hoạt | ✗ | ✗ | ✓ | ✓ |
| Xem tất cả barcode | ✗ | ✗ | ✓ | ✓ |
| CRUD đại lý | ✗ | ✗ | ✗ | ✓ |
| CRUD sản phẩm | ✗ | ✗ | ✗ | ✓ |
| CRUD khách hàng | ✗ | ✗ | ✗ | ✓ |
| CRUD barcode | ✗ | ✗ | ✗ | ✓ |

---

## 🌐 Điểm Cuối API

### Dev Xác Thực (Không cần token)

```
POST /api/auth/login                  Đăng nhập password NV/QT
POST /api/auth/otp/request            Yêu cầu OTP
POST /api/auth/otp/verify             Xác thực OTP & đăng nhập
POST /api/auth/refresh                Làm mới access token
POST /api/auth/logout                 Hủy refresh token
```

### Tự Phục Vụ (/me)

```
GET  /api/me                                     Profile (mọi vai trò)
GET  /api/me/activations?skip=0&take=10        Kích hoạt KH
GET  /api/me/dealer/stats?from=2025-01-01      Thống kê ĐL
GET  /api/me/dealer/activations?skip=0&take=10 Kích hoạt ĐL
```

### Quản Lý Barcode (Chỉ NV/QT)

```
POST /api/barcodes                    Thêm 1 barcode
POST /api/barcodes/batch              Nhập hàng loạt
GET  /api/barcodes?sku=P001&status=UNUSED  Danh sách với lọc
```

### Kích Hoạt (Chỉ NV/QT)

```
POST /api/activations                 Tạo kích hoạt
GET  /api/activations                 Danh sách kích hoạt
GET  /api/activations/stats           Thống kê tóm tắt
```

### CRUD Quản Trị

```
GET  /api/products                    Danh sách sản phẩm
POST /api/products                    Tạo sản phẩm
GET  /api/dealers                     Danh sách đại lý
POST /api/dealers                     Tạo đại lý
GET  /api/customers                   Danh sách khách hàng
```

**Xem [ARCHITECTURE.md](ARCHITECTURE.md) để có API spec đầy đủ với ví dụ JSON.**

---

## 🧪 Kiểm Thử

Test suite toàn diện bao gồm xác thực, RBAC, quản lý barcode, và UI flow:

```bash
# Xem tất cả test case
cat TEST_CASES.md
```

**Danh mục Test**:
- **TC-A**: Xác thực / OTP / Refresh Token (11 case)
- **TC-B**: Quản Lý Barcode (10 case)
- **TC-C**: RBAC Kích Hoạt (7 case)
- **TC-D**: Endpoint /me (8 case)
- **TC-E**: ZMP UI Flow (10 case)
- **TC-F**: Regression Test (4 case)

---

## 🛠️ Stack Công Nghệ

### Backend
- **Runtime**: Node.js 18+
- **Framework**: NestJS 10.3
- **Database**: PostgreSQL 13+ với Prisma 5.10 ORM
- **Xác thực**: JWT + OTP + bcrypt
- **Validation**: class-validator, class-transformer

### Frontend (ZMP)
- **Framework**: React 18
- **Ngôn ngữ**: TypeScript 5
- **Trạng thái**: Jotai (atoms)
- **UI Components**: zmp-ui, ZMPRouter
- **Quét Camera**: ZMP SDK `scanQRCode`
- **Style**: SCSS + Tailwind CSS
- **Build**: Vite

### Admin Dashboard
- **Framework**: React 18
- **Ngôn ngữ**: TypeScript 5
- **UI**: Ant Design 5
- **Build**: Vite
- **Quản lý trạng thái**: Ant Design Form + Hooks

---

## 📊 Schema DB (Điểm Nổi Bật v3)

### Mới Trong v3
- **BarcodeStatus enum**: UNUSED, USED
- **BarcodeItem**: Thêm `createdById`, `usedById`, `status`
- **User**: Quan hệ mới `barcodesCreated`, `barcodesUsed`

### Các Bảng Chính
- `User` – Tài khoản NV/QT
- `UserAccount` – Tài khoản KH/ĐL với OTP
- `Dealer` – Profile đại lý
- `Customer` – Profile khách hàng
- `Product` – Danh mục sản phẩm
- `BarcodeItem` – Barcode vật lý
- `Activation` – Giao dịch trao điểm
- `AuditLog` – Lịch sử hoạt động
- `RefreshToken` – Lưu trữ token rotation

---

## 🚢 Triển Khai

### Môi Trường Dev (Cục Bộ)
```
Backend:   http://localhost:3001/api
ZMP:       http://localhost:3000
Admin:     http://localhost:5174
Database:  localhost:5432 (PostgreSQL)
```

### Sản Xuất
1. **Backend**: Triển khai NestJS (Heroku, Railway, DigitalOcean)
   - Cập nhật `DATABASE_URL` sang production
   - Đặt mật khẩu `JWT_SECRET` mạnh
   - Enable CORS cho domain ZMP
   
2. **ZMP**: Triển khai lên Zalo Mini App Platform
   ```bash
   zmp login
   zmp deploy
   ```

3. **Admin**: Triển khai React (Vercel, Netlify)
   - Cập nhật API base URL sang production

---

## 📖 Tài Liệu

- **[ARCHITECTURE.md](ARCHITECTURE.md)** – Thiết kế toàn hệ thống, ma trận RBAC, API spec
- **[TEST_CASES.md](TEST_CASES.md)** – 50+ test case
- **[FEATURES.md](FEATURES.md)** – Danh sách tính năng v3 & backlog v4+

---

## 🔗 Tài Nguyên

- [Zalo Mini App Chính Thức](https://mini.zalo.me/)
- [ZMP SDK Docs](https://mini.zalo.me/documents/api/)
- [ZaUI Components](https://mini.zalo.me/documents/zaui/)
- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Jotai State Management](https://jotai.org/)

---

## 📝 Giấy Phép & Hỗ Trợ

**Phiên bản**: 3.0 | **Cập nhật Cuối**: Tháng 2 năm 2025 | **Trạng thái**: Sản xuất

Để có câu hỏi, xem ARCHITECTURE.md, TEST_CASES.md hoặc lịch sử git commit.
