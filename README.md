# Natri Loyalty Points System – Zalo Mini App

**Version**: v3 | **Status**: Production Ready

Comprehensive loyalty points management system for Natri beverages featuring 4-role authentication (Customer, Dealer, Staff, Admin), barcode scanning, and real-time point tracking.

## 📋 Project Overview

Natri Loyalty Points System is a complete digital ecosystem for managing product promotions and customer engagement:

- **Customers**: Track earned points through purchases via dealers
- **Dealers**: Monitor sales activity, manage activations, track commission points
- **Staff**: Scan product barcodes, create activations (award customer points)
- **Admin**: Full operational control via web dashboard

### Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│           NATRI LOYALTY POINTS SYSTEM v3                │
├──────────────────┬──────────────────┬──────────────────┤
│   ZMP Frontend   │   Backend API    │  Admin Dashboard │
│   (React/TS)     │  (NestJS/Prisma) │  (React/Ant)     │
│   Port: 3000     │   Port: 3001     │   Port: 5174     │
│  4-role Login    │   PostgreSQL     │   Full CRUD      │
│  Camera Scan     │   4 Role RBAC    │   Reporting      │
└─────────────────┴──────────────────┴──────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ with npm
- **PostgreSQL** 13+ (running locally or Docker)
- **Zalo Mini App CLI** (for ZMP deployment only)

### 1️⃣ Backend Setup

```bash
cd backend
npm install --legacy-peer-deps
```

**Configure Database** – Create `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/natri_loyalty"
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRATION=900
JWT_REFRESH_EXPIRATION=604800
OTP_EXPIRATION=300
PHONE_OTP_LENGTH=6
```

**Database Migration & Seed**:
```bash
npx prisma migrate dev --name initial
npx prisma db seed
```

**Start Backend** (port 3001):
```bash
npm run start:dev
```

### 2️⃣ Zalo Mini App (ZMP) Setup

```bash
cd .
npm install
```

**Start ZMP** (port 3000):
```bash
zmp start
```

### 3️⃣ Admin Dashboard Setup

```bash
cd admin
npm install --legacy-peer-deps
```

**Start Admin Dashboard** (port 5174):
```bash
npm run dev
```

---

## 🔐 Mock Credentials

### Frontend (ZMP) & Backend Login

| Role | Method | Username/Phone | Password/OTP |
|------|--------|--------|--------|
| **CUSTOMER** | OTP | 0351234567 | 123456 |
| **DEALER** | OTP | 0901234567 | 123456 |
| **STAFF** | Password | staff01 | staff123 |
| **ADMIN** | Password | admin | admin123 |

**Dealer Lookup**: Enter code `DL001` to find "Cửa hàng An Khang"

### Admin Dashboard

Same as ADMIN credentials above (username: `admin`, password: `admin123`)

---

## 🏗️ Project Structure

```
natri-zalo/
├── backend/                          # NestJS API Server
│   ├── src/
│   │   ├── auth/                    # JWT, OTP flows
│   │   ├── barcodes/                # Barcode management (POST/GET)
│   │   ├── activations/             # Point activation logic
│   │   ├── me/                      # Self-service endpoints
│   │   ├── products/                # Product catalog
│   │   ├── dealers/                 # Dealer management
│   │   ├── customers/               # Customer management
│   │   ├── guards/                  # Auth & RBAC guards
│   │   └── app.module.ts
│   ├── prisma/
│   │   ├── schema.prisma            # DB schema (v3: BarcodeStatus)
│   │   └── seed.ts                  # Mock data
│   └── package.json
│
├── src/                              # Zalo Mini App (ZMP)
│   ├── pages/
│   │   ├── login.tsx               # 4-role auth
│   │   ├── staff-home.tsx          # Staff menu
│   │   ├── admin-home.tsx          # Admin menu
│   │   ├── barcode-manage.tsx      # Camera scan + add barcode
│   │   ├── customer-history.tsx    # Customer activation log
│   │   ├── dealer-dashboard.tsx    # Dealer stats
│   │   └── [other pages]
│   ├── components/
│   │   ├── layout.tsx              # Routing
│   │   ├── clock.tsx
│   │   └── logo.tsx
│   ├── services/
│   │   ├── api-client.ts           # API calls
│   │   ├── mock-service.ts         # Mock implementation
│   │   └── scanner.ts              # Camera/barcode QR
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   └── app.ts                       # Entry point
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
│   │   ├── services/                # API integration
│   │   ├── mock/
│   │   │   └── mockData.ts          # Mock CRUD data
│   │   └── App.tsx
│   └── package.json
│
├── ARCHITECTURE.md                   # v3 system design
├── TEST_CASES.md                     # Comprehensive test suite
├── package.json
├── tsconfig.json
└── README.md (this file)
```

---

## 🔄 Key Workflows

### 📱 Customer Journey
```
DealerLookup (search "DL001")
    ↓
Login (OTP: 0351234567 + 123456)
    ↓
CustomerHistory (view earned points)
```

### 🛒 Staff Point Activation
```
Staff Login (staff01 / staff123)
    ↓
Staff Home ("Tích điểm" button)
    ↓
Scan Barcode (or manual input)
    ↓
Enter Customer Phone + Select Dealer
    ↓
Confirm → Points awarded ✓
```

### 📦 Staff Barcode Management
```
Staff Login
    ↓
Staff Home ("Quản lý Barcode" button)
    ↓
"Quét Camera" (camera scan barcode)
    OR
Manual Input (type barcode code)
    ↓
Select Product SKU (dropdown)
    ↓
"Thêm Barcode" → Added to system ✓
    ↓
View Recent List (filter by SKU/status)
```

### 👨‍💼 Dealer Dashboard
```
Dealer Login (OTP: 0901234567 + 123456)
    ↓
Dealer Dashboard
    ├── Stats (total sales, points, daily/weekly/monthly breakdown)
    └── Activations (list all sales through this dealer)
```

### ⚙️ Admin Control
```
Admin Login (web: admin / admin123)
    ↓
Dashboard
    ├── Dealers (CRUD)
    ├── Products (CRUD)
    ├── Customers (view)
    ├── Activations (view/export)
    └── Barcodes (view, mass import)
```

---

## 🔐 RBAC Matrix (v3)

| Action | CUSTOMER | DEALER | STAFF | ADMIN |
|--------|----------|--------|-------|-------|
| View own profile | ✓ | ✓ | ✓ | ✓ |
| View own activations | ✓ | ✓ | ✗ | ✗ |
| View dealer stats | ✗ | ✓ | ✗ | ✗ |
| **Create activation** | ✗ | ✗ | ✓ | ✓ |
| **Add barcode** | ✗ | ✗ | ✓ | ✓ |
| View all activations | ✗ | ✗ | ✓ | ✓ |
| View all barcodes | ✗ | ✗ | ✓ | ✓ |
| CRUD dealer | ✗ | ✗ | ✗ | ✓ |
| CRUD product | ✗ | ✗ | ✗ | ✓ |
| CRUD customer | ✗ | ✗ | ✗ | ✓ |
| CRUD barcode | ✗ | ✗ | ✗ | ✓ |

---

## 🌐 API Endpoints

### Auth (No Auth Required)

```
POST /api/auth/login                  Staff/Admin password login
POST /api/auth/otp/request            Request OTP for customer/dealer
POST /api/auth/otp/verify             Verify OTP and get tokens
POST /api/auth/refresh                Refresh access token
POST /api/auth/logout                 Revoke refresh token
```

### Self-Service (/me)

```
GET  /api/me                                     Profile (all roles)
GET  /api/me/activations?skip=0&take=10        Customer activations
GET  /api/me/dealer/stats?from=2025-01-01      Dealer statistics
GET  /api/me/dealer/activations?skip=0&take=10 Dealer activations
```

### Barcode Management (STAFF/ADMIN Only)

```
POST /api/barcodes                    Create single barcode
POST /api/barcodes/batch              Batch import barcodes
GET  /api/barcodes?sku=P001&status=UNUSED&skip=0&take=50  List with filters
```

### Activations (STAFF/ADMIN Only)

```
POST /api/activations                 Create activation (tích điểm)
GET  /api/activations?skip=0&take=20  List all activations
GET  /api/activations/stats           Summary stats
```

### Admin CRUD

```
GET  /api/products                    List products
POST /api/products                    Create product
GET  /api/dealers                     List dealers
POST /api/dealers                     Create dealer
GET  /api/customers                   List customers
```

**See [ARCHITECTURE.md](ARCHITECTURE.md) for full API spec with JSON examples.**

---

## 🧪 Testing

Comprehensive test suite covering auth, RBAC, barcode management, and UI flows:

```bash
# View all test cases
cat TEST_CASES.md
```

**Test Categories**:
- **TC-A**: Auth / OTP / Refresh Token (11 cases)
- **TC-B**: Barcode Management (10 cases)
- **TC-C**: Activations RBAC (7 cases)
- **TC-D**: Self-service /me endpoints (8 cases)
- **TC-E**: ZMP UI Flows (10 cases)
- **TC-F**: Regression Tests (4 cases)

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: NestJS 10.3
- **Database**: PostgreSQL 13+ with Prisma 5.10 ORM
- **Auth**: JWT + OTP + bcrypt password hashing
- **Validation**: class-validator, class-transformer

### Frontend (ZMP)
- **Framework**: React 18
- **Language**: TypeScript 5
- **State**: Jotai (atoms)
- **UI Components**: zmp-ui, ZMPRouter
- **Scanner**: ZMP SDK `scanQRCode`
- **Styling**: SCSS + Tailwind CSS
- **Build**: Vite

### Admin Dashboard
- **Framework**: React 18
- **Language**: TypeScript 5
- **UI**: Ant Design 5
- **Build**: Vite
- **State**: Ant Design Form + Custom hooks

---

## 📊 DB Schema (v3 Highlights)

### New in v3
- **BarcodeStatus enum**: UNUSED, USED
- **BarcodeItem**: Added `createdById`, `usedById`, `status` fields
- **User**: New relations `barcodesCreated`, `barcodesUsed` for audit trail

### Core Tables
- `User` – Staff/Admin accounts
- `UserAccount` – Customer/Dealer accounts with OTP
- `Dealer` – Dealer profiles
- `Customer` – Customer profiles
- `Product` – Product catalog (SKU-based)
- `BarcodeItem` – Physical barcodes with tracking
- `Activation` – Point award transactions
- `AuditLog` – Activity trail
- `RefreshToken` – Token rotation storage

---

## 🚢 Deployment

### Development Environment (All on localhost)
```
Backend:   http://localhost:3001/api
ZMP:       http://localhost:3000
Admin:     http://localhost:5174
Database:  localhost:5432 (PostgreSQL)
```

### Production
1. **Backend**: Deploy NestJS on cloud (Heroku, Railway, DigitalOcean)
   - Update `DATABASE_URL` to production DB
   - Set strong `JWT_SECRET`
   - Enable CORS for ZMP domain
   
2. **ZMP**: Deploy to Zalo Mini App Platform
   ```bash
   zmp login
   zmp deploy
   ```

3. **Admin**: Deploy React app (Vercel, Netlify)
   - Update API base URL to production backend

---

## 📖 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** – Full system design, RBAC matrix, API spec with JSON examples
- **[TEST_CASES.md](TEST_CASES.md)** – All 50 test cases (auth, RBAC, UI flows)

---

## 🔗 Resources

- [Zalo Mini App Official](https://mini.zalo.me/)
- [ZMP SDK Docs](https://mini.zalo.me/documents/api/)
- [ZaUI Components](https://mini.zalo.me/documents/zaui/)
- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Jotai State Management](https://jotai.org/)

---

## 📝 License & Support

**Version**: 3.0 | **Last Updated**: February 2025 | **Status**: Production Ready

For issues or questions, refer to ARCHITECTURE.md and TEST_CASES.md or check git commit history for detailed implementation changes.
