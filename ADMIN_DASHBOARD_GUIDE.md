# Admin Dashboard Documentation

> Hướng dẫn sử dụng bảng điều khiển quản lý hệ thống tích điểm Natri

---

## 📋 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Bảng điều khiển chính](#bảng-điều-khiển-chính)
3. [Báo cáo doanh thu](#báo-cáo-doanh-thu)
4. [Quản lý khách hàng & đại lý](#quản-lý-khách-hàng--đại-lý)
5. [Cấu hình và bảo trì](#cấu-hình-và-bảo-trì)
6. [API Documentation](#api-documentation)

---

## 🎯 Tổng quan

### Chức năng chính

| Tính năng | Mô tả | Người dùng |
|-----------|-------|-----------|
| **Dashboard** | KPI tổng quan, xu hướng 7-30 ngày | ADMIN, STAFF |
| **Revenue Report** | Báo cáo doanh thu theo thời gian, đại lý, sản phẩm | ADMIN |
| **Customers** | Danh sách khách hàng, điểm tích lũy | STAFF |
| **Dealers** | Danh sách đại lý, thành tích | STAFF |
| **Products** | Quản lý sản phẩm, barcode | ADMIN |
| **Staff Logs** | Lịch sử hoạt động nhân viên | ADMIN |

### Người dùng & Quyền

```javascript
ADMIN
├─ Xem tất cả báo cáo, thống kê
├─ Cấu hình hệ thống
├─ Quản lý nhân viên
└─ Export dữ liệu

STAFF
├─ Xem dashboard
├─ Xem khách hàng & đại lý
├─ Ghi nhận kích hoạt
└─ Xem báo cáo cơ bản

DEALER
├─ Xem thành tích cá nhân
├─ Xem khách hàng (của shop)
└─ Yêu cầu rút điểm

CUSTOMER
├─ Xem điểm cá nhân
├─ Lịch sử ghi nhận
└─ Yêu cầu đổi thưởng
```

---

## 📊 Bảng điều khiển chính

### Layout

```
┌─────────────────────────────────────────┐
│  Lựa chọn khoảng thời gian + Làm mới    │
├─────────────────────────────────────────┤
│   KPI Cards (Tổng quét | Điểm | Doanh)  │
├─────────────────────────────────────────┤
│   Biểu đồ xu hướng (30 ngày qua)        │
├─────────────────────────────────────────┤
│  Top 10 Đại lý      │    Top 10 Khách   │
├─────────────────────────────────────────┤
│  Chi tiết ghi nhận (Bảng dữ liệu)       │
└─────────────────────────────────────────┘
```

### Phần tử chính

#### 1. Bộ lọc thời gian

```jsx
// Khoảng thời gian nhanh
1 ngày | 7 ngày | 30 ngày | 90 ngày | Tùy chỉnh

// Khi chọn "Tùy chỉnh"
┌──────────────┬──────────────┐
│  Từ ngày     │  Đến ngày    │
└──────────────┴──────────────┘
```

**Ví dụ:**
- "7 ngày": Hiển thị dữ liệu từ 7 ngày trước đến hôm nay
- "Tùy chỉnh": Chọn khoảng tuỳ ý

#### 2. KPI Cards (Thẻ chỉ số)

```
┌──────────────────────┐
│  ⚡ Tổng quét        │
│     245 (↑ 12%)     │
└──────────────────────┘

Giải thích:
- Số quá: 245 lần ghi nhận barcode
- Xu hướng: Tăng 12% so với kỳ trước
- Biểu tượng ↑: Tăng trưởng tích cực
```

**4 KPI chính:**
1. **Tổng quét barcode** - số lần ghi nhận
2. **Điểm cấp phát** - tổng điểm phát sinh
3. **Doanh thu ước tính** - Điểm × 1000 VND
4. **Khách hàng & Đại lý** - số lượng

#### 3. Biểu đồ xu hướng

```
│         📊 Xu hướng quét barcode (01/12 - 31/12)
│
│  ███                        Trục Y: Số lần quét
│  ███                        Trục X: Ngày/Tuần/Tháng
│ ⬚███⬚                      Hover: Xem chi tiết
│ ⬚███⬚ ███                  
│ ⬚███⬚ ███ ███            
│ ⬚███⬚ ███ ███ ███
└─────────────────────────
  01  05  10  15  20  25  30
```

**Tương tác:**
- Hover qua cột: Xem "ngày X: 12 quét"
- Click cột: Filter dữ liệu theo ngày (có thể thêm)

#### 4. Top 10 Đại lý

| Mã | Cửa hàng | Quét | Điểm | Doanh thu | Khách |
|----|----|-------|-------|----------|-------|
| DL001 | Cửa hàng An Khang | 45 | 45 điểm | 45.0M | 35 |
| DL002 | Đại lý Bình Minh | 38 | 38 điểm | 38.0M | 28 |

**Sắp xếp:**
- Mặc định: Theo doanh thu
- Có thể click header: Sắp xếp theo bất kỳ cột

#### 5. Top 10 Khách hàng

| Tên | SĐT | Lần mua | Điểm | Đại lý | Ghi nhận cuối |
|-----|-----|--------|------|-------|----------|
| Nguyễn Văn A | 0901... | 5 | 5💚 | 2 | 15/12 08:30 |
| Trần Thị B | 0902... | 4 | 4💚 | 1 | 14/12 16:45 |

**Thông tin:**
- Cột Điểm: Màu xanh lá (💚)
- Cột Ghi nhận: Ngày giờ lần ghi nhận gần nhất
- Click hàng: Xem lịch sử chi tiết

#### 6. Chi tiết ghi nhận

Bảng dữ liệu đầy đủ với pagination (20 hàng/trang)

**Columns:**
```
Thời gian | Barcode | Sản phẩm | Khách hàng | Đại lý | Điểm
```

---

## 💰 Báo cáo doanh thu

### Layout

```
┌─────────────────────────────────────────┐
│  📊 Báo cáo doanh thu & hiệu suất       │
├─────────────────────────────────────────┤
│  [Bộ lọc]                               │
│  - Khoảng thời gian                     │
│  - Thời gian báo cáo: Ngày/Tuần/Tháng  │
│  - Đại lý (dropdown)                    │
│  - Sản phẩm (dropdown)                  │
│  [Xuất CSV] [Xuất Excel]                │
├─────────────────────────────────────────┤
│  KPI: Tổng doanh thu | Ghi nhận | Điểm │
├─────────────────────────────────────────┤
│  [Tab 1: Theo thời gian]                │
│  [Tab 2: Theo đại lý]                   │
│  [Tab 3: Theo sản phẩm]                 │
└─────────────────────────────────────────┘
```

### Tab 1: Theo thời gian

**Báo cáo hàng ngày:** (chọn "Ngày")
```
Kỳ báo cáo | Ghi nhận | Điểm | Doanh thu | Khách/Đại lý
2024-12-15 |   2890  | 2890 |   2.89M   |  1200 / 45
2024-12-14 |   2543  | 2543 |   2.54M   |  1100 / 42
```

**Báo cáo hàng tuần:** (chọn "Tuần")
```
Kỳ báo cáo | Ghi nhận | Điểm | Doanh thu | Khách/Đại lý
Tuần 50/2024 |  18900 | 18900|  18.9M   |  8500 / 280
Tuần 49/2024 |  17800 | 17800|  17.8M   |  8200 / 270
```

**Báo cáo tháng:** (chọn "Tháng")
```
Kỳ báo cáo | Ghi nhận | Điểm | Doanh thu | Khách/Đại lý
2024-12   |  85000  | 85000|  85.0M   | 40000 / 300
2024-11   |  78900  | 78900|  78.9M   | 38000 / 285
```

### Tab 2: Theo đại lý

```
Mã đại lý | Cửa hàng | Ghi nhận | Điểm | Doanh thu | Khách
DL001    | An Khang | 5000   | 5000 |  5.0M    | 3500
DL002    | Bình Minh| 4800   | 4800 |  4.8M    | 3200
```

**Phân tích:**
- Xếp hạng đại lý theo doanh thu
- So sánh thành tích
- Tiền thưởng/ bonus calculation

### Tab 3: Theo sản phẩm

```
SKU   | Tên sản phẩm | Ghi nhận | Điểm | Doanh thu | Đại lý bán
YTX5A | Bình... YTX5A| 18000   | 18K  |   18M    |   85
12N5L | Bình... 12N5L| 15000   | 15K  |   15M    |   72
```

**Phân tích:**
- Sản phẩm bán chạy nhất
- Điểm mạnh yếu sản phẩm
- Quyết định sản phẩm khuyến mãi

### Export & Print

```
[Xuất CSV]     → Download file .csv (dùng Excel)
[Xuất Excel]   → Download file .xlsx (format đẹp)
[In báo cáo]   → Mở PDF để in (Ctrl+P)
```

**Export CSV Example:**
```
Thời gian,Ghi nhận,Điểm,Doanh Thu
2024-12-15,2890,2890,2890000
2024-12-14,2543,2543,2543000
```

---

## 👥 Quản lý khách hàng & Đại lý

### Trang Khách hàng

```
[Tìm theo tên hoặc SĐT]

Tên | SĐT | Điểm | [Sắp xếp: Điểm ↑/↓]

Nguyễn Văn A | 0901234567 | 125 💚
Trần Thị B   | 0902345678 | 98  💚
```

**Chức năng:**
- Tìm kiếm theo tên/SĐT
- Sắp xếp theo điểm (tăng/giảm)
- Click hàng để xem chi tiết

### Trang Đại lý

```
Mã | Cửa hàng | SĐT | Địa chỉ | Điểm | [Tìm]

DL001 | Cửa hàng An Khang | 0901... | 123 Lê Lợi | 425 💚
```

**Tính năng:**
- Filter theo trạng thái (hoạt động/không)
- Xem thành tích cá nhân
- Chi tiết liên hệ

---

## ⚙️ Cấu hình và bảo trì

### Settings (ADMIN only)

```
┌─────────────────────────────────────┐
│  🛠️  Cấu hình hệ thống              │
├─────────────────────────────────────┤
│  Tỷ lệ chuyển đổi điểm             │
│  [1 điểm = ? VND]                   │
│  
│  Quy tắc barcode                    │
│  [ ] Cho phép barcode lặp           │
│  [ ] Yêu cầu upload receipt         │
│  
│  Email thông báo                    │
│  [ ] Kích hoạt thành công           │
│  [ ] Lỗi kích hoạt                  │
│  [ ] Báo cáo hàng ngày              │
│  
│  [Lưu cấu hình]                     │
└─────────────────────────────────────┘
```

### Staff Management (ADMIN only)

```
Danh sách nhân viên:

Username | Tên đầy đủ | Quyền | Trạng thái | Hành động
admin    | Trần Văn A | ADMIN | ✅ Hoạt động | Edit / Delete
staff1   | Nguyễn B   | STAFF | ✅ Hoạt động | Edit / Delete

[+ Thêm nhân viên]
```

### Lệnh Docker (Deployment)

```bash
# Build
docker build -t admin-dashboard .

# Run
docker run -p 3002:3002 \
  -e VITE_API_BASE_URL=https://api.your-domain.com \
  admin-dashboard
```

---

## 📡 API Documentation

### Authentication

```bash
# Login (ADMIN / STAFF)
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": { "id": "...", "role": "ADMIN" }
}
```

### Analytics Endpoints

#### Dashboard KPIs

```bash
GET /api/analytics/dashboard/kpis?dateFrom=2024-12-01&dateTo=2024-12-31

Response:
{
  "period": {
    "from": "2024-12-01T00:00:00Z",
    "to": "2024-12-31T23:59:59Z"
  },
  "totalActivations": 85000,
  "totalPoints": 85000,
  "revenue": 85000000,
  "averagePerActivation": 1000,
  "uniqueCustomers": 40000,
  "uniqueDealers": 300,
  "trend": 12.5
}
```

#### Top Dealers

```bash
GET /api/analytics/top-dealers?dateFrom=2024-12-01&dateTo=2024-12-31&limit=10

Response:
[
  {
    "id": "d1",
    "code": "DL001",
    "shopName": "Cửa hàng An Khang",
    "activations": 5000,
    "points": 5000,
    "revenue": 5000000
  },
  ...
]
```

#### Top Customers

```bash
GET /api/analytics/top-customers?limit=10

Response:
[
  {
    "id": "c1",
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "activations": 45,
    "points": 45,
    "pointsTotal": 125
  },
  ...
]
```

#### Revenue Timeline

```bash
GET /api/analytics/revenue/timeline?granularity=daily

Response:
[
  {
    "period": "2024-12-15",
    "activations": 2890,
    "points": 2890,
    "revenue": 2890000
  },
  {
    "period": "2024-12-14",
    "activations": 2543,
    "points": 2543,
    "revenue": 2543000
  },
  ...
]
```

#### Staff Activity

```bash
GET /api/analytics/staff-activity?dateFrom=2024-12-01

Response:
[
  {
    "staffId": "user1",
    "staffName": "Trần Văn A",
    "activations": 500,
    "pointsProcessed": 500
  },
  ...
]
```

#### System Health

```bash
GET /api/analytics/health

Response:
{
  "status": "healthy",
  "timestamp": "2024-12-15T10:30:00Z",
  "dbStatus": "connected",
  "metrics": {
    "customers": 40000,
    "dealers": 300,
    "activations": 85000,
    "products": 5
  }
}
```

### Rate Limiting

```
API Rate Limit: 1000 requests per minute per IP
Admin Rate Limit: 500 requests per minute per IP

If exceeded:
HTTP 429 Too Many Requests
Header: Retry-After: 60
```

---

## 🎓 Tutorial: Sử dụng Dashboard hiệu quả

### Bước 1: Đăng nhập

1. Truy cập: https://your-domain.com/admin
2. Nhập username & password
3. Click "Đăng nhập"

### Bước 2: Xem tổng quan

1. Dashboard → Tab "Tổng quan"
2. Chọn khoảng thời gian (1d / 7d / 30d)
3. Xem 4 KPI chính

### Bước 3: Phân tích doanh thu

1. Dashboard → "Báo cáo doanh thu"
2. Chọn bộ lọc:
   - Loại: Theo tháng
   - Khoảng: 3 tháng gần nhất
   - Đại lý: (để trống = tất cả)
3. Xem biểu đồ, so sánh với tháng trước
4. Export CSV để phân tích trong Excel

### Bước 4: Quản lý thành tích

1. "Đại lý" → Sắp xếp theo "Doanh thu" (↓)
2. Nhận diện top performers
3. "Khách hàng" → Tìm VIP customers
4. Chuẩn bị chương trình khuyến mãi

### Bước 5: Báo cáo trình quản lý

1. Export báo cáo hàng tháng:
   - Tổng quét barcode
   - Doanh thu
   - Top 10 đại lý
   - Top 10 khách hàng
2. PDF report (in hoặc email)
3. Present insights & recommendations

---

## ❓ FAQ

**Q: Làm sao để xem lịch sử barcode?**
A: Dashboard → "Chi tiết" → Search barcode hoặc filter by product

**Q: Doanh thu tính như thế nào?**
A: Doanh thu = Tổng điểm × 1,000 VND (có thể cấu hình)

**Q: Có thể export dữ liệu để phân tích?**
A: Có, mỗi trang đều có nút "Xuất CSV" hoặc "Xuất Excel"

**Q: Làm sao quản lý discount / promotion?**
A: Cải thiện trong phase 2 (hiện chưa có)

---

**Liên hệ hỗ trợ**: support@your-domain.com
