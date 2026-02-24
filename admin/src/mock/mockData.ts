// ===== Mock data for Admin Dashboard =====
import dayjs from 'dayjs';

export const mockDealers = [
  { id: 'd1', code: 'DL001', name: 'Nguyễn Văn An',  phone: '0901234567', shopName: 'Cửa hàng An Khang',   address: '123 Lê Lợi, Q1, HCM',        points: 15, active: true },
  { id: 'd2', code: 'DL002', name: 'Trần Thị Bình',   phone: '0912345678', shopName: 'Đại lý Bình Minh',    address: '456 Nguyễn Huệ, Q1, HCM',    points: 8,  active: true },
  { id: 'd3', code: 'DL003', name: 'Lê Hoàng Cường',  phone: '0923456789', shopName: 'Siêu thị mini Cường', address: '789 Trần Hưng Đạo, Q5, HCM', points: 22, active: true },
  { id: 'd4', code: 'DL004', name: 'Phạm Minh Đức',   phone: '0934567890', shopName: 'Shop Đức Phát',       address: '321 Hai Bà Trưng, Q3, HCM',  points: 5,  active: true },
  { id: 'd5', code: 'DL005', name: 'Hoàng Thị Em',    phone: '0945678901', shopName: 'Tạp hóa Em',          address: '654 Võ Văn Tần, Q3, HCM',    points: 3,  active: false },
];

export const mockProducts = [
  { id: 'p1', name: 'Natri Ion 500ml',          sku: 'P001', barcodeCount: 10, active: true },
  { id: 'p2', name: 'Natri Ion 1.5L',           sku: 'P002', barcodeCount: 10, active: true },
  { id: 'p3', name: 'Natri Ion Thùng 12 chai',  sku: 'P003', barcodeCount: 10, active: true },
  { id: 'p4', name: 'Natri Ion Sport 750ml',    sku: 'P004', barcodeCount: 10, active: true },
  { id: 'p5', name: 'Natri Ion Zero 500ml',     sku: 'P005', barcodeCount: 10, active: true },
];

export const mockCustomers = [
  { id: 'c1',  name: 'Nguyễn Thị Hồng',  phone: '0351234567', points: 7 },
  { id: 'c2',  name: 'Trần Văn Khoa',     phone: '0562345678', points: 5 },
  { id: 'c3',  name: 'Lê Minh Tuấn',      phone: '0773456789', points: 12 },
  { id: 'c4',  name: 'Phạm Thị Lan',      phone: '0384567890', points: 3 },
  { id: 'c5',  name: 'Hoàng Văn Nam',      phone: '0595678901', points: 8 },
  { id: 'c6',  name: 'Đỗ Thị Oanh',       phone: '0706789012', points: 2 },
  { id: 'c7',  name: 'Bùi Quốc Phong',    phone: '0817890123', points: 9 },
  { id: 'c8',  name: 'Vũ Thị Quỳnh',      phone: '0928901234', points: 4 },
  { id: 'c9',  name: 'Đinh Văn Sơn',       phone: '0339012345', points: 6 },
  { id: 'c10', name: 'Mai Thị Trang',      phone: '0850123456', points: 11 },
];

// Generate 20 mock activations
export const mockActivations = Array.from({ length: 20 }, (_, i) => {
  const daysAgo = Math.floor(Math.random() * 14);
  const customer = mockCustomers[i % mockCustomers.length];
  const dealer = i % 3 === 0 ? null : mockDealers[i % mockDealers.length];
  const product = mockProducts[i % mockProducts.length];
  return {
    id: `act_${i + 1}`,
    barcode: `893600${String(i + 1).padStart(4, '0')}`,
    product: { name: product.name, sku: product.sku },
    customer: { name: customer.name, phone: customer.phone },
    dealer: dealer ? { code: dealer.code, name: dealer.name } : null,
    staff: { username: i % 2 === 0 ? 'admin' : 'staff01', fullName: i % 2 === 0 ? 'Admin Natri' : 'Nhân viên 01' },
    pointsAwarded: 1,
    createdAt: dayjs().subtract(daysAgo, 'day').subtract(Math.floor(Math.random() * 12), 'hour').toISOString(),
  };
});

// Daily activations for charts
export const mockDailyActivations = Array.from({ length: 30 }, (_, i) => ({
  date: dayjs().subtract(29 - i, 'day').format('YYYY-MM-DD'),
  count: Math.floor(Math.random() * 10) + 1,
}));

export const mockUsers = [
  { id: 'u1', username: 'admin',   fullName: 'Admin Natri',   role: 'ADMIN', active: true },
  { id: 'u2', username: 'staff01', fullName: 'Nhân viên 01',  role: 'STAFF', active: true },
  { id: 'u3', username: 'staff02', fullName: 'Nhân viên 02',  role: 'STAFF', active: false },
];
