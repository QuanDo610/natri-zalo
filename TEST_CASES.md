# Test Cases — Hệ thống Tích điểm Natri (v2)

## A) Test Cases — OTP Authentication

| # | Tên test case | Input | Expected | Status |
|---|---------------|-------|----------|--------|
| A1 | Request OTP — SĐT hợp lệ | `POST /auth/otp/request` phone=0351234567 | 200, `{ message: "OTP sent", expiresIn: 300 }` | |
| A2 | Request OTP — SĐT sai format | phone=12345 | 400, "Invalid Vietnamese phone number" | |
| A3 | Verify OTP — đúng mã | phone+code+role=CUSTOMER | 200, accessToken + refreshToken + user | |
| A4 | Verify OTP — sai mã | code=999999 | 401, "Invalid or expired OTP" | |
| A5 | Verify OTP — hết hạn | code đúng nhưng > 5 phút | 401, "Invalid or expired OTP" | |
| A6 | Verify OTP — tự tạo Customer mới | phone chưa có trong DB | 200, user.role=CUSTOMER, auto-create | |
| A7 | Verify OTP — Dealer không tồn tại | role=DEALER, phone không khớp dealer | 400, "No dealer found..." | |
| A8 | Verify OTP — Dealer hợp lệ | role=DEALER, phone=0901234567 (DL001) | 200, user.dealerId set, dealer info | |

## B) Test Cases — Refresh Token

| # | Tên test case | Input | Expected | Status |
|---|---------------|-------|----------|--------|
| B1 | Refresh — token hợp lệ | `POST /auth/refresh` refreshToken=valid | 200, new accessToken + refreshToken | |
| B2 | Refresh — token đã revoke | refreshToken=revoked | 401, "Invalid or expired refresh token" | |
| B3 | Refresh — token hết hạn | refreshToken=expired | 401 | |
| B4 | Logout — revoke token | `POST /auth/logout` refreshToken=valid | 200, "Logged out" | |
| B5 | Refresh sau logout | refreshToken đã logout | 401 | |

## C) Test Cases — Staff/Admin Login

| # | Tên test case | Input | Expected | Status |
|---|---------------|-------|----------|--------|
| C1 | Login admin đúng | admin / admin123 | 200, role=ADMIN, accessToken | |
| C2 | Login staff đúng | staff01 / staff123 | 200, role=STAFF, accessToken | |
| C3 | Login sai password | admin / wrong | 401, "Invalid credentials" | |
| C4 | Login user không tồn tại | unknown / 123 | 401 | |

## D) Test Cases — Customer History (GET /me/activations)

| # | Tên test case | Input | Expected | Status |
|---|---------------|-------|----------|--------|
| D1 | Xem lịch sử — customer login | Bearer token (CUSTOMER) | 200, danh sách activations của customer | |
| D2 | Lọc theo thời gian — 7 ngày | dateFrom=7d ago | 200, chỉ items trong 7 ngày | |
| D3 | Lọc theo từ khóa | search=Natri | 200, chỉ items có "Natri" | |
| D4 | Phân trang | skip=0, take=5 | 200, max 5 items, total đúng | |
| D5 | Customer xem data người khác | token customer A, query customer B | 403 hoặc chỉ trả data của A | |
| D6 | DEALER gọi /me/activations | Bearer token (DEALER) | 403, chỉ CUSTOMER được phép | |
| D7 | Không có token | No Authorization header | 401 | |

## E) Test Cases — Dealer Dashboard (GET /dealer/me/*)

| # | Tên test case | Input | Expected | Status |
|---|---------------|-------|----------|--------|
| E1 | GET /dealer/me — profile | Bearer (DEALER) | 200, dealer info (code, name, points) | |
| E2 | GET /dealer/me/stats | Bearer (DEALER) | 200, totalActivations, uniqueCustomers, activationsToday/Week/Month | |
| E3 | GET /dealer/me/activations | Bearer (DEALER) | 200, danh sách activations qua đại lý này | |
| E4 | Tìm kiếm activations | search=Hồng | 200, chỉ items có KH "Hồng" | |
| E5 | CUSTOMER gọi /dealer/me | Bearer (CUSTOMER) | 403, chỉ DEALER được phép | |
| E6 | ADMIN gọi /dealer/me | Bearer (ADMIN) | 403, không phải DEALER | |

## F) Test Cases — RBAC & Ownership

| # | Tên test case | Input | Expected | Status |
|---|---------------|-------|----------|--------|
| F1 | CUSTOMER tạo activation | POST /activations, Bearer (CUSTOMER) | 200, staffId=null | |
| F2 | DEALER tạo activation | POST /activations, Bearer (DEALER) | 200, staffId=null | |
| F3 | STAFF tạo activation | POST /activations, Bearer (STAFF) | 200, staffId=staff.id | |
| F4 | CUSTOMER gọi GET /dealers (admin) | Bearer (CUSTOMER) | 403 | |
| F5 | DEALER gọi GET /activations/stats | Bearer (DEALER) | 403, chỉ ADMIN | |

## G) Test Cases — Kích hoạt (giữ nguyên từ v1)

| # | Tên test case | Input | Expected | Status |
|---|---------------|-------|----------|--------|
| G1 | Kích hoạt barcode hợp lệ + dealer | barcode=8936000021, DL001, 0351234567 | 200, +1 điểm KH + ĐL | |
| G2 | Barcode đã kích hoạt (trùng) | barcode đã activated=true | 409 Conflict | |
| G3 | Barcode không tồn tại | barcode=0000000000 | 400 Bad Request | |
| G4 | SĐT sai format | phone=12345 | 400 Validation Error | |
| G5 | Dealer code sai | dealerCode=XXXXX | 404 Not Found | |
| G6 | Kích hoạt không có dealer | dealerCode omitted | 200, dealerPointsAfter=null | |

---

## H) Curl Examples (v2)

### H.1) OTP Authentication

```bash
# Request OTP
curl -X POST http://localhost:3001/api/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{ "phone": "0351234567" }'

# Verify OTP (as Customer)
curl -X POST http://localhost:3001/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{ "phone": "0351234567", "code": "123456", "role": "CUSTOMER" }'

# Verify OTP (as Dealer)
curl -X POST http://localhost:3001/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{ "phone": "0901234567", "code": "123456", "role": "DEALER" }'
```

### H.2) Refresh & Logout

```bash
# Refresh token
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "TOKEN_FROM_LOGIN" }'

# Logout
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "TOKEN_FROM_LOGIN" }'
```

### H.3) Customer History

```bash
# Get profile
curl http://localhost:3001/api/me \
  -H "Authorization: Bearer CUSTOMER_ACCESS_TOKEN"

# Get activation history (with filters)
curl "http://localhost:3001/api/me/activations?take=10&search=Natri" \
  -H "Authorization: Bearer CUSTOMER_ACCESS_TOKEN"
```

### H.4) Dealer Dashboard

```bash
# Get dealer profile
curl http://localhost:3001/api/dealer/me \
  -H "Authorization: Bearer DEALER_ACCESS_TOKEN"

# Get dealer stats
curl http://localhost:3001/api/dealer/me/stats \
  -H "Authorization: Bearer DEALER_ACCESS_TOKEN"

# Get dealer activations
curl "http://localhost:3001/api/dealer/me/activations?take=10" \
  -H "Authorization: Bearer DEALER_ACCESS_TOKEN"
```

### H.5) Staff/Admin Login

```bash
# Admin login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "username": "admin", "password": "admin123" }'

# Create activation (as staff)
curl -X POST http://localhost:3001/api/activations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer STAFF_ACCESS_TOKEN" \
  -d '{
    "barcode": "8936000021",
    "customer": { "name": "Nguyễn Thị Hồng", "phone": "0351234567" },
    "dealerCode": "DL001"
  }'
```
