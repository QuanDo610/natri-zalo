# Hệ thống Tích điểm Zalo Mini App - Kiến trúc tổng thể

## A) Kiến trúc hệ thống

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Zalo Mini App      │     │   Admin Dashboard    │     │    PostgreSQL   │
│  (React + zmp-ui)   │     │  (React + AntDesign) │     │    Database     │
│                     │     │                      │     │                 │
│  - Dealer Lookup    │     │  - Overview          │     │  - users        │
│  - Earn Points      │     │  - Dealers CRUD      │     │  - dealers      │
│  - Result           │     │  - Products/Barcodes │     │  - products     │
│                     │     │  - Customers         │     │  - barcode_items│
└────────┬────────────┘     │  - Activations       │     │  - customers    │
         │                  │  - Users CRUD        │     │  - activations  │
         │ REST API         └──────────┬───────────┘     │  - audit_logs   │
         │                             │ REST API        └────────┬────────┘
         │         ┌───────────────────┘                          │
         ▼         ▼                                              │
    ┌─────────────────────────┐                                   │
    │   Backend (NestJS)      │───────────────────────────────────┘
    │   Node.js + TypeScript  │         Prisma ORM
    │                         │
    │  Modules:               │
    │  - AuthModule (JWT)     │
    │  - DealerModule         │
    │  - ProductModule        │
    │  - CustomerModule       │
    │  - ActivationModule     │
    └─────────────────────────┘
```

## B) DB Schema

### Bảng Users (staff/admin)
| Column       | Type         | Constraint                |
|-------------|-------------|---------------------------|
| id          | UUID         | PK, default uuid          |
| username    | VARCHAR(50)  | UNIQUE, NOT NULL          |
| password    | VARCHAR(255) | NOT NULL (bcrypt hash)    |
| fullName    | VARCHAR(100) | NOT NULL                  |
| role        | ENUM         | 'admin' \| 'staff'       |
| active      | BOOLEAN      | DEFAULT true              |
| createdAt   | TIMESTAMP    | DEFAULT NOW()             |
| updatedAt   | TIMESTAMP    | auto-update               |

### Bảng Dealers (đại lý)
| Column     | Type         | Constraint                |
|-----------|-------------|---------------------------|
| id        | UUID         | PK                        |
| code      | VARCHAR(20)  | UNIQUE, NOT NULL, INDEX   |
| name      | VARCHAR(100) | NOT NULL                  |
| phone     | VARCHAR(15)  | NOT NULL                  |
| shopName  | VARCHAR(200) | NOT NULL                  |
| address   | TEXT         |                           |
| points    | INT          | DEFAULT 0, >= 0           |
| active    | BOOLEAN      | DEFAULT true              |
| createdAt | TIMESTAMP    |                           |
| updatedAt | TIMESTAMP    |                           |

### Bảng Products (sản phẩm)
| Column    | Type         | Constraint                |
|----------|-------------|---------------------------|
| id       | UUID         | PK                        |
| name     | VARCHAR(200) | NOT NULL                  |
| sku      | VARCHAR(50)  | UNIQUE, NOT NULL          |
| active   | BOOLEAN      | DEFAULT true              |
| createdAt| TIMESTAMP    |                           |

### Bảng BarcodeItems (barcode/serial → product)
| Column      | Type         | Constraint                       |
|------------|-------------|----------------------------------|
| id         | UUID         | PK                               |
| barcode    | VARCHAR(100) | **UNIQUE**, NOT NULL, INDEX      |
| productId  | UUID         | FK → Products.id, NOT NULL       |
| activated  | BOOLEAN      | DEFAULT false                    |
| activatedAt| TIMESTAMP    | NULL                             |
| createdAt  | TIMESTAMP    |                                  |

> **Chống kích hoạt trùng**: barcode UNIQUE + activated flag + DB transaction

### Bảng Customers (khách hàng)
| Column    | Type         | Constraint                |
|----------|-------------|---------------------------|
| id       | UUID         | PK                        |
| name     | VARCHAR(100) | NOT NULL                  |
| phone    | VARCHAR(15)  | UNIQUE, NOT NULL, INDEX   |
| points   | INT          | DEFAULT 0, >= 0           |
| createdAt| TIMESTAMP    |                           |
| updatedAt| TIMESTAMP    |                           |

### Bảng Activations (giao dịch kích hoạt)
| Column       | Type         | Constraint                |
|-------------|-------------|---------------------------|
| id          | UUID         | PK                        |
| barcodeItemId| UUID        | FK → BarcodeItems.id, UNIQUE |
| customerId  | UUID         | FK → Customers.id         |
| dealerId    | UUID         | FK → Dealers.id, NULL     |
| staffId     | UUID         | FK → Users.id             |
| productId   | UUID         | FK → Products.id          |
| pointsAwarded| INT         | DEFAULT 1                 |
| createdAt   | TIMESTAMP    |                           |

### Bảng AuditLogs
| Column    | Type         | Constraint                |
|----------|-------------|---------------------------|
| id       | UUID         | PK                        |
| action   | VARCHAR(50)  | NOT NULL                  |
| entity   | VARCHAR(50)  | NOT NULL                  |
| entityId | UUID         |                           |
| userId   | UUID         | FK → Users.id             |
| metadata | JSONB        |                           |
| createdAt| TIMESTAMP    |                           |

## C) API Spec (REST)

### Auth
| Method | Endpoint        | Body                                    | Response 200                                   |
|--------|----------------|----------------------------------------|-----------------------------------------------|
| POST   | /auth/login    | `{"username":"admin","password":"123"}` | `{"accessToken":"eyJ...","role":"admin"}`     |

### Dealers
| Method | Endpoint                    | Response 200                                                  |
|--------|----------------------------|--------------------------------------------------------------|
| GET    | /dealers/lookup?code=DL001 | `{"id":"...","code":"DL001","name":"Nguyen A","shopName":"...","phone":"...","address":"...","points":5}` |

### Products
| Method | Endpoint                          | Response 200                                    |
|--------|----------------------------------|-------------------------------------------------|
| GET    | /products/by-barcode/:barcode    | `{"id":"...","name":"Natri Ion 500ml","sku":"P001","barcode":"8936..."}`  |

### Customers
| Method | Endpoint                      | Body / Response                                  |
|--------|------------------------------|--------------------------------------------------|
| POST   | /customers/upsert            | Body: `{"name":"Tran B","phone":"0901234567"}` → `{"id":"...","points":3}` |
| GET    | /customers/by-phone/:phone   | `{"id":"...","name":"Tran B","phone":"...","points":3,"activations":[...]}` |

### Activations
| Method | Endpoint         | Body                                                         | Response 201                                              |
|--------|-----------------|--------------------------------------------------------------|----------------------------------------------------------|
| POST   | /activations    | `{"barcode":"8936...","customer":{"name":"Tran B","phone":"0901234567"},"dealerCode":"DL001"}` | `{"activationId":"...","product":{"name":"Natri Ion 500ml"},"customerPointsAfter":4,"dealerPointsAfter":6}` |

**Error responses:**
- 400: `{"statusCode":400,"message":"Barcode not found"}`
- 409: `{"statusCode":409,"message":"Barcode already activated"}`
- 404: `{"statusCode":404,"message":"Dealer not found"}`

## D) Luồng xử lý Activation (Transaction)

```
POST /activations
  │
  ▼
  Validate DTO (barcode, phone format, name)
  │
  ▼
  prisma.$transaction(async (tx) => {
    1. Tìm BarcodeItem WHERE barcode = ? AND activated = false
       → Nếu không tìm thấy: barcode không tồn tại hoặc đã kích hoạt → throw
    2. Upsert Customer (phone unique)
    3. Nếu có dealerCode → tìm Dealer → nếu không tồn tại → throw 404
    4. Update BarcodeItem: activated = true, activatedAt = now()
    5. Update Customer: points += 1
    6. Nếu có Dealer: Update Dealer: points += 1
    7. Create Activation record
    8. Create AuditLog
    9. Return result
  })
```

## E) Quy tắc Validation

| Field      | Rule                                      | Regex / Format           |
|-----------|------------------------------------------|--------------------------|
| phone VN  | 10 số, bắt đầu 0(3\|5\|7\|8\|9)         | `/^0(3|5|7|8|9)\d{8}$/`  |
| dealerCode| 2-20 ký tự, chữ + số, bắt đầu chữ       | `/^[A-Z]{2}\d{3,}$/`     |
| barcode   | 8-20 ký tự số                             | `/^\d{8,20}$/`           |
| name      | 2-100 ký tự, không ký tự đặc biệt        | min 2, max 100           |

## F) Kịch bản Test

| # | Kịch bản                      | Input                                           | Expected                                  |
|---|-------------------------------|------------------------------------------------|------------------------------------------|
| 1 | Happy path (có dealer)        | barcode valid + customer + dealerCode DL001    | 201, customer +1, dealer +1             |
| 2 | Happy path (không dealer)     | barcode valid + customer, no dealerCode        | 201, customer +1, dealerPointsAfter=null |
| 3 | Duplicate barcode             | barcode đã activated                            | 409 Conflict                             |
| 4 | Barcode không tồn tại         | barcode "9999999999"                            | 400 Bad Request                          |
| 5 | Dealer không tồn tại          | dealerCode "DL999"                              | 404 Not Found                            |
| 6 | Phone không hợp lệ            | phone "012345"                                  | 400 Validation Error                     |
| 7 | Barcode rỗng                  | barcode ""                                      | 400 Validation Error                     |
| 8 | Concurrent activation         | 2 request cùng barcode đồng thời               | 1 thành công, 1 fail 409                 |

## G) Triển khai local

```bash
# 1. Backend
cd backend
cp .env.example .env
# Sửa DATABASE_URL trong .env
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev

# 2. Frontend ZMP
cd ..  # root
npm install
zmp start
# Mở localhost:3000

# 3. Admin Dashboard
cd admin
npm install
npm run dev
# Mở localhost:5173
```

### ENV Variables
```env
# Backend (.env)
DATABASE_URL=postgresql://postgres:password@localhost:5432/natri_loyalty
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
PORT=3001

# Frontend (.env)
VITE_API_BASE_URL=http://localhost:3001
VITE_MOCK_MODE=true

# Admin (.env)
VITE_API_BASE_URL=http://localhost:3001
```
