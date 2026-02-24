# Test Cases & cURL Examples

## A) Bảng Test Cases

| #  | Kịch bản                           | Input                                                                                   | Expected Status | Expected Response                                                     |
|----|-------------------------------------|-----------------------------------------------------------------------------------------|----------------|-----------------------------------------------------------------------|
| 1  | Happy path + dealer                 | barcode: `8936000021`, phone: `0351234567`, name: `Nguyễn Thị Hồng`, dealerCode: `DL001` | 201            | `activationId`, product: Natri Ion 500ml, customerPoints +1, dealerPoints +1 |
| 2  | Happy path, no dealer               | barcode: `8936000022`, phone: `0562345678`, name: `Trần Văn Khoa`                        | 201            | `activationId`, product info, dealerPointsAfter: null                 |
| 3  | Duplicate barcode                   | barcode: `8936000001` (đã activated)                                                     | 409            | `"Barcode has already been activated"`                                |
| 4  | Barcode not found                   | barcode: `9999999999`                                                                    | 400            | `"Barcode not found"`                                                 |
| 5  | Dealer not found                    | dealerCode: `DL999`                                                                      | 404            | `"Dealer not found"`                                                  |
| 6  | Invalid phone format                | phone: `012345`                                                                          | 400            | Validation error: phone                                               |
| 7  | Empty barcode                       | barcode: ``                                                                               | 400            | Validation error: barcode                                             |
| 8  | Name too short                      | name: `A`                                                                                 | 400            | Validation error: name min 2                                          |
| 9  | Invalid dealer code format          | dealerCode: `abc`                                                                         | 400            | Validation error: dealer code format                                  |
| 10 | New customer (upsert)               | phone mới: `0701111111`, name: `Khách Mới`                                               | 201            | Customer created, points = 1                                          |
| 11 | Existing customer (upsert)          | phone đã tồn tại: `0351234567`, name mới                                                 | 201            | Customer updated, points incremented                                  |
| 12 | Concurrent same barcode             | 2 requests cùng barcode `8936000023`                                                     | 1×201, 1×409   | DB unique constraint prevents double activation                       |
| 13 | Lookup valid dealer                 | GET /dealers/lookup?code=DL001                                                            | 200            | Dealer info with points                                               |
| 14 | Lookup invalid dealer               | GET /dealers/lookup?code=DL999                                                            | 404            | Not found                                                             |
| 15 | Product by valid barcode            | GET /products/by-barcode/8936000021                                                       | 200            | Product info, activated: false                                        |
| 16 | Product by used barcode             | GET /products/by-barcode/8936000001                                                       | 200            | Product info, activated: true                                         |
| 17 | Auth login success                  | POST /auth/login {username: admin, password: admin123}                                    | 200            | JWT token + user info                                                 |
| 18 | Auth login fail                     | POST /auth/login {username: admin, password: wrong}                                       | 401            | Invalid credentials                                                   |

## B) cURL Examples

### 1. Login (get JWT token)
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "...", "username": "admin", "fullName": "Admin Natri", "role": "ADMIN" }
}
```

### 2. Lookup Dealer
```bash
curl "http://localhost:3001/api/dealers/lookup?code=DL001"
```
Response:
```json
{
  "id": "uuid...",
  "code": "DL001",
  "name": "Nguyễn Văn An",
  "phone": "0901234567",
  "shopName": "Cửa hàng An Khang",
  "address": "123 Lê Lợi, Q1, HCM",
  "points": 5
}
```

### 3. Product by Barcode
```bash
curl "http://localhost:3001/api/products/by-barcode/8936000021"
```
Response:
```json
{
  "id": "uuid...",
  "name": "Natri Ion 500ml",
  "sku": "P001",
  "barcode": "8936000021",
  "activated": false,
  "activatedAt": null
}
```

### 4. Create Activation (Happy path + dealer)
```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X POST http://localhost:3001/api/activations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "barcode": "8936000021",
    "customer": { "name": "Nguyễn Thị Hồng", "phone": "0351234567" },
    "dealerCode": "DL001"
  }'
```
Response (201):
```json
{
  "activationId": "uuid...",
  "product": { "id": "uuid...", "name": "Natri Ion 500ml", "sku": "P001" },
  "customerPointsAfter": 4,
  "dealerPointsAfter": 6
}
```

### 5. Create Activation (No dealer)
```bash
curl -X POST http://localhost:3001/api/activations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "barcode": "8936000022",
    "customer": { "name": "Trần Văn Khoa", "phone": "0562345678" }
  }'
```
Response (201):
```json
{
  "activationId": "uuid...",
  "product": { "id": "uuid...", "name": "Natri Ion 1.5L", "sku": "P002" },
  "customerPointsAfter": 3,
  "dealerPointsAfter": null
}
```

### 6. Duplicate Barcode (Error)
```bash
curl -X POST http://localhost:3001/api/activations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "barcode": "8936000001",
    "customer": { "name": "Test", "phone": "0351234567" }
  }'
```
Response (409):
```json
{
  "statusCode": 409,
  "message": "Barcode \"8936000001\" has already been activated"
}
```

### 7. Barcode Not Found
```bash
curl -X POST http://localhost:3001/api/activations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "barcode": "9999999999",
    "customer": { "name": "Test", "phone": "0351234567" }
  }'
```
Response (400):
```json
{
  "statusCode": 400,
  "message": "Barcode \"9999999999\" not found"
}
```

### 8. Dealer Not Found
```bash
curl -X POST http://localhost:3001/api/activations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "barcode": "8936000023",
    "customer": { "name": "Test", "phone": "0351234567" },
    "dealerCode": "DL999"
  }'
```
Response (404):
```json
{
  "statusCode": 404,
  "message": "Dealer with code \"DL999\" not found"
}
```

### 9. Upsert Customer
```bash
curl -X POST http://localhost:3001/api/customers/upsert \
  -H "Content-Type: application/json" \
  -d '{"name":"Khách mới","phone":"0701111111"}'
```

### 10. Get Customer by Phone
```bash
curl "http://localhost:3001/api/customers/by-phone/0351234567"
```

### 11. Get Activation Stats (Admin only)
```bash
curl "http://localhost:3001/api/activations/stats" \
  -H "Authorization: Bearer $TOKEN"
```

### 12. List All Activations
```bash
curl "http://localhost:3001/api/activations?skip=0&take=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 13. List Dealers (Admin)
```bash
curl "http://localhost:3001/api/dealers" \
  -H "Authorization: Bearer $TOKEN"
```

### 14. Import Barcodes (Admin)
```bash
curl -X POST "http://localhost:3001/api/products/PRODUCT_UUID/import-barcodes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcodes":["8936001001","8936001002","8936001003"]}'
```
