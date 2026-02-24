// ===== Mock Data & API for local development (v2 — with auth, OTP, history) =====

import type {
  DealerInfo,
  ProductInfo,
  ActivationRequest,
  ActivationResponse,
  CustomerInfo,
  LoginResponse,
  OtpRequestResponse,
  ActivationHistoryItem,
  PaginatedResponse,
  DealerStats,
  AuthUser,
} from '@/types';

// ---- Dealers ----
const dealers: DealerInfo[] = [
  { id: 'd1', code: 'DL001', name: 'Nguyễn Văn An',  phone: '0901234567', shopName: 'Cửa hàng An Khang',   address: '123 Lê Lợi, Q1, HCM',          points: 5 },
  { id: 'd2', code: 'DL002', name: 'Trần Thị Bình',   phone: '0912345678', shopName: 'Đại lý Bình Minh',    address: '456 Nguyễn Huệ, Q1, HCM',      points: 3 },
  { id: 'd3', code: 'DL003', name: 'Lê Hoàng Cường',  phone: '0923456789', shopName: 'Siêu thị mini Cường', address: '789 Trần Hưng Đạo, Q5, HCM',   points: 8 },
  { id: 'd4', code: 'DL004', name: 'Phạm Minh Đức',   phone: '0934567890', shopName: 'Shop Đức Phát',       address: '321 Hai Bà Trưng, Q3, HCM',    points: 2 },
  { id: 'd5', code: 'DL005', name: 'Hoàng Thị Em',    phone: '0945678901', shopName: 'Tạp hóa Em',          address: '654 Võ Văn Tần, Q3, HCM',      points: 0 },
];

// ---- Products ----
const products = [
  { id: 'p1', name: 'Natri Ion 500ml',          sku: 'P001' },
  { id: 'p2', name: 'Natri Ion 1.5L',           sku: 'P002' },
  { id: 'p3', name: 'Natri Ion Thùng 12 chai',  sku: 'P003' },
  { id: 'p4', name: 'Natri Ion Sport 750ml',    sku: 'P004' },
  { id: 'p5', name: 'Natri Ion Zero 500ml',     sku: 'P005' },
];

// ---- Barcodes (50) ----
interface BarcodeItemMock {
  barcode: string;
  productId: string;
  activated: boolean;
  activatedAt: string | null;
}

const barcodeItems: BarcodeItemMock[] = [];
for (let i = 1; i <= 50; i++) {
  const barcode = `893600${String(i).padStart(4, '0')}`;
  const productIndex = (i - 1) % products.length;
  barcodeItems.push({
    barcode,
    productId: products[productIndex].id,
    activated: i <= 20,
    activatedAt: i <= 20 ? new Date(Date.now() - Math.random() * 14 * 86400000).toISOString() : null,
  });
}

// ---- Customers ----
const customers: (CustomerInfo & { activations: string[] })[] = [
  { id: 'c1',  name: 'Nguyễn Thị Hồng',  phone: '0351234567', points: 3, activations: [] },
  { id: 'c2',  name: 'Trần Văn Khoa',     phone: '0562345678', points: 2, activations: [] },
  { id: 'c3',  name: 'Lê Minh Tuấn',      phone: '0773456789', points: 4, activations: [] },
  { id: 'c4',  name: 'Phạm Thị Lan',      phone: '0384567890', points: 1, activations: [] },
  { id: 'c5',  name: 'Hoàng Văn Nam',      phone: '0595678901', points: 2, activations: [] },
  { id: 'c6',  name: 'Đỗ Thị Oanh',       phone: '0706789012', points: 0, activations: [] },
  { id: 'c7',  name: 'Bùi Quốc Phong',    phone: '0817890123', points: 3, activations: [] },
  { id: 'c8',  name: 'Vũ Thị Quỳnh',      phone: '0928901234', points: 1, activations: [] },
  { id: 'c9',  name: 'Đinh Văn Sơn',       phone: '0339012345', points: 2, activations: [] },
  { id: 'c10', name: 'Mai Thị Trang',      phone: '0850123456', points: 2, activations: [] },
];

// ---- Mock activation history (seeded for first 20 barcodes) ----
interface MockActivation extends ActivationHistoryItem {}
const activationHistory: MockActivation[] = [];
for (let i = 0; i < 20; i++) {
  const bc = barcodeItems[i];
  const product = products.find((p) => p.id === bc.productId)!;
  const customer = customers[i % customers.length];
  const dealer = i % 3 === 0 ? null : dealers[i % dealers.length];
  activationHistory.push({
    id: `act_seed_${i + 1}`,
    pointsAwarded: 1,
    createdAt: bc.activatedAt || new Date().toISOString(),
    product: { name: product.name, sku: product.sku },
    dealer: dealer ? { code: dealer.code, name: dealer.name, shopName: dealer.shopName } : null,
    customer: { name: customer.name, phone: customer.phone },
    barcodeItem: { barcode: bc.barcode },
  });
}

// ---- OTP store (mock) ----
const otpStore: Record<string, { code: string; expiresAt: number }> = {};

// ---- Auth state (mock) ----
let mockAuthUser: AuthUser | null = null;

// ---- Helper: simulate delay ----
const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));

// ===== Mock API implementation =====
export const mockApi = {
  // ── Public endpoints ──────────────────────
  lookupDealer: async (code: string): Promise<DealerInfo> => {
    await delay(300);
    const dealer = dealers.find((d) => d.code === code);
    if (!dealer) {
      throw { statusCode: 404, message: `Dealer with code "${code}" not found` };
    }
    return { ...dealer };
  },

  findProductByBarcode: async (barcode: string): Promise<ProductInfo> => {
    await delay(300);
    const item = barcodeItems.find((b) => b.barcode === barcode);
    if (!item) {
      throw { statusCode: 400, message: `Barcode "${barcode}" not found` };
    }
    const product = products.find((p) => p.id === item.productId)!;
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: item.barcode,
      activated: item.activated,
      activatedAt: item.activatedAt,
    };
  },

  createActivation: async (data: ActivationRequest): Promise<ActivationResponse> => {
    await delay(600);
    const item = barcodeItems.find((b) => b.barcode === data.barcode);
    if (!item) throw { statusCode: 400, message: `Barcode "${data.barcode}" not found` };
    if (item.activated) throw { statusCode: 409, message: `Barcode "${data.barcode}" has already been activated` };

    let dealer: DealerInfo | undefined;
    if (data.dealerCode) {
      dealer = dealers.find((d) => d.code === data.dealerCode);
      if (!dealer) throw { statusCode: 404, message: `Dealer with code "${data.dealerCode}" not found` };
    }
    if (!/^0(3|5|7|8|9)\d{8}$/.test(data.customer.phone)) {
      throw { statusCode: 400, message: 'Invalid Vietnamese phone number' };
    }

    item.activated = true;
    item.activatedAt = new Date().toISOString();

    let customer = customers.find((c) => c.phone === data.customer.phone);
    if (customer) {
      customer.name = data.customer.name;
      customer.points += 1;
    } else {
      customer = { id: `c${customers.length + 1}`, name: data.customer.name, phone: data.customer.phone, points: 1, activations: [] };
      customers.push(customer);
    }
    if (dealer) dealer.points += 1;

    const product = products.find((p) => p.id === item.productId)!;

    // Add to history
    activationHistory.unshift({
      id: `act_${Date.now()}`,
      pointsAwarded: 1,
      createdAt: item.activatedAt,
      product: { name: product.name, sku: product.sku },
      dealer: dealer ? { code: dealer.code, name: dealer.name, shopName: dealer.shopName } : null,
      customer: { name: customer.name, phone: customer.phone },
      barcodeItem: { barcode: item.barcode },
    });

    return {
      activationId: `act_${Date.now()}`,
      product: { id: product.id, name: product.name, sku: product.sku },
      customerPointsAfter: customer.points,
      dealerPointsAfter: dealer?.points ?? null,
    };
  },

  getCustomerByPhone: async (phone: string): Promise<CustomerInfo> => {
    await delay(300);
    const customer = customers.find((c) => c.phone === phone);
    if (!customer) throw { statusCode: 404, message: `Customer with phone "${phone}" not found` };
    return { id: customer.id, name: customer.name, phone: customer.phone, points: customer.points };
  },

  // ── Auth: OTP ─────────────────────────────
  requestOtp: async (phone: string): Promise<OtpRequestResponse> => {
    await delay(300);
    if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) {
      throw { statusCode: 400, message: 'Invalid Vietnamese phone number' };
    }
    const code = '123456'; // Mock: always 123456
    otpStore[phone] = { code, expiresAt: Date.now() + 5 * 60 * 1000 };
    console.log(`[MOCK OTP] Phone: ${phone}, Code: ${code}`);
    return { message: 'OTP sent', expiresIn: 300 };
  },

  verifyOtp: async (phone: string, code: string, role: 'CUSTOMER' | 'DEALER'): Promise<LoginResponse> => {
    await delay(400);
    const stored = otpStore[phone];
    if (!stored || stored.code !== code || stored.expiresAt < Date.now()) {
      throw { statusCode: 401, message: 'Invalid or expired OTP' };
    }
    delete otpStore[phone];

    let user: AuthUser;

    if (role === 'CUSTOMER') {
      let customer = customers.find((c) => c.phone === phone);
      if (!customer) {
        customer = { id: `c${customers.length + 1}`, name: phone, phone, points: 0, activations: [] };
        customers.push(customer);
      }
      user = {
        id: `ua_${phone}`,
        phone,
        role: 'CUSTOMER',
        customerId: customer.id,
        customer: { id: customer.id, name: customer.name, phone: customer.phone, points: customer.points },
      };
    } else {
      const dealer = dealers.find((d) => d.phone === phone);
      if (!dealer) throw { statusCode: 400, message: 'No dealer found with this phone number. Contact admin to register.' };
      user = {
        id: `ua_${phone}`,
        phone,
        role: 'DEALER',
        dealerId: dealer.id,
        dealer,
      };
    }

    mockAuthUser = user;

    return {
      accessToken: `mock_access_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      user,
    };
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    await delay(200);
    return {
      accessToken: `mock_access_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
    };
  },

  logout: async (refreshToken: string): Promise<{ message: string }> => {
    await delay(200);
    mockAuthUser = null;
    return { message: 'Logged out' };
  },

  loginStaff: async (username: string, password: string): Promise<LoginResponse> => {
    await delay(400);
    if (username === 'admin' && password === 'admin123') {
      const user: AuthUser = { id: 'u1', username: 'admin', fullName: 'Admin Natri', role: 'ADMIN' };
      mockAuthUser = user;
      return { accessToken: `mock_access_${Date.now()}`, refreshToken: `mock_refresh_${Date.now()}`, user };
    }
    if (username === 'staff01' && password === 'staff123') {
      const user: AuthUser = { id: 'u2', username: 'staff01', fullName: 'Nhân viên 01', role: 'STAFF' };
      mockAuthUser = user;
      return { accessToken: `mock_access_${Date.now()}`, refreshToken: `mock_refresh_${Date.now()}`, user };
    }
    throw { statusCode: 401, message: 'Invalid credentials' };
  },

  // ── Me (customer) ─────────────────────────
  getProfile: async (): Promise<any> => {
    await delay(300);
    if (!mockAuthUser) throw { statusCode: 401, message: 'Unauthorized' };
    return { role: mockAuthUser.role, customer: mockAuthUser.customer, dealer: mockAuthUser.dealer };
  },

  getMyActivations: async (params: {
    skip?: number;
    take?: number;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<PaginatedResponse<ActivationHistoryItem>> => {
    await delay(400);
    if (!mockAuthUser || !mockAuthUser.customerId) throw { statusCode: 401, message: 'Unauthorized' };

    const customer = customers.find((c) => c.id === mockAuthUser!.customerId);
    let filtered = activationHistory.filter((a) => a.customer?.phone === customer?.phone);

    if (params.dateFrom) {
      const from = new Date(params.dateFrom).getTime();
      filtered = filtered.filter((a) => new Date(a.createdAt).getTime() >= from);
    }
    if (params.dateTo) {
      const to = new Date(params.dateTo).getTime();
      filtered = filtered.filter((a) => new Date(a.createdAt).getTime() <= to);
    }
    if (params.search) {
      const s = params.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.product.name.toLowerCase().includes(s) ||
          a.barcodeItem.barcode.includes(s),
      );
    }

    const skip = params.skip || 0;
    const take = params.take || 20;
    return {
      data: filtered.slice(skip, skip + take),
      total: filtered.length,
      skip,
      take,
    };
  },

  // ── Dealer self-service ───────────────────
  getDealerProfile: async (): Promise<DealerInfo> => {
    await delay(300);
    if (!mockAuthUser || !mockAuthUser.dealerId) throw { statusCode: 401, message: 'Unauthorized' };
    const dealer = dealers.find((d) => d.id === mockAuthUser!.dealerId);
    if (!dealer) throw { statusCode: 404, message: 'Dealer not found' };
    return { ...dealer };
  },

  getDealerStats: async (): Promise<DealerStats> => {
    await delay(400);
    if (!mockAuthUser || !mockAuthUser.dealerId) throw { statusCode: 401, message: 'Unauthorized' };
    const dealer = dealers.find((d) => d.id === mockAuthUser!.dealerId);
    if (!dealer) throw { statusCode: 404, message: 'Dealer not found' };

    const myActivations = activationHistory.filter(
      (a) => a.dealer?.code === dealer.code,
    );
    const now = Date.now();
    const dayMs = 86400000;
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

    return {
      dealer: { points: dealer.points, code: dealer.code, name: dealer.name, shopName: dealer.shopName },
      totalActivations: myActivations.length,
      activationsToday: myActivations.filter((a) => new Date(a.createdAt).getTime() >= todayStart).length,
      activationsWeek: myActivations.filter((a) => new Date(a.createdAt).getTime() >= now - 7 * dayMs).length,
      activationsMonth: myActivations.filter((a) => new Date(a.createdAt).getTime() >= now - 30 * dayMs).length,
      uniqueCustomers: new Set(myActivations.map((a) => a.customer?.phone)).size,
      totalPoints: dealer.points,
    };
  },

  getDealerActivations: async (params: {
    skip?: number;
    take?: number;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<PaginatedResponse<ActivationHistoryItem>> => {
    await delay(400);
    if (!mockAuthUser || !mockAuthUser.dealerId) throw { statusCode: 401, message: 'Unauthorized' };
    const dealer = dealers.find((d) => d.id === mockAuthUser!.dealerId);
    if (!dealer) throw { statusCode: 404, message: 'Dealer not found' };

    let filtered = activationHistory.filter((a) => a.dealer?.code === dealer.code);

    if (params.dateFrom) {
      const from = new Date(params.dateFrom).getTime();
      filtered = filtered.filter((a) => new Date(a.createdAt).getTime() >= from);
    }
    if (params.dateTo) {
      const to = new Date(params.dateTo).getTime();
      filtered = filtered.filter((a) => new Date(a.createdAt).getTime() <= to);
    }
    if (params.search) {
      const s = params.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.customer?.name.toLowerCase().includes(s) ||
          a.customer?.phone.includes(s) ||
          a.barcodeItem.barcode.includes(s),
      );
    }

    const skip = params.skip || 0;
    const take = params.take || 20;
    return {
      data: filtered.slice(skip, skip + take),
      total: filtered.length,
      skip,
      take,
    };
  },
};
