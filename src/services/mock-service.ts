// ===== Mock Data for local development =====

import type {
  DealerInfo,
  ProductInfo,
  ActivationRequest,
  ActivationResponse,
  CustomerInfo,
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
interface BarcodeItem {
  barcode: string;
  productId: string;
  activated: boolean;
  activatedAt: string | null;
}

const barcodeItems: BarcodeItem[] = [];
for (let i = 1; i <= 50; i++) {
  const barcode = `893600${String(i).padStart(4, '0')}`;
  const productIndex = (i - 1) % products.length;
  barcodeItems.push({
    barcode,
    productId: products[productIndex].id,
    activated: i <= 20, // first 20 already used
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

// ---- Helper: simulate delay ----
const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));

// ===== Mock API implementation =====
export const mockApi = {
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

    // Validate barcode exists
    const item = barcodeItems.find((b) => b.barcode === data.barcode);
    if (!item) {
      throw { statusCode: 400, message: `Barcode "${data.barcode}" not found` };
    }

    // Check duplicate
    if (item.activated) {
      throw { statusCode: 409, message: `Barcode "${data.barcode}" has already been activated` };
    }

    // Validate dealer if provided
    let dealer: DealerInfo | undefined;
    if (data.dealerCode) {
      dealer = dealers.find((d) => d.code === data.dealerCode);
      if (!dealer) {
        throw { statusCode: 404, message: `Dealer with code "${data.dealerCode}" not found` };
      }
    }

    // Validate phone format
    if (!/^0(3|5|7|8|9)\d{8}$/.test(data.customer.phone)) {
      throw { statusCode: 400, message: 'Invalid Vietnamese phone number' };
    }

    // Process activation
    item.activated = true;
    item.activatedAt = new Date().toISOString();

    // Upsert customer
    let customer = customers.find((c) => c.phone === data.customer.phone);
    if (customer) {
      customer.name = data.customer.name;
      customer.points += 1;
    } else {
      customer = {
        id: `c${customers.length + 1}`,
        name: data.customer.name,
        phone: data.customer.phone,
        points: 1,
        activations: [],
      };
      customers.push(customer);
    }

    // Update dealer points
    if (dealer) {
      dealer.points += 1;
    }

    const product = products.find((p) => p.id === item.productId)!;

    return {
      activationId: `act_${Date.now()}`,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
      },
      customerPointsAfter: customer.points,
      dealerPointsAfter: dealer?.points ?? null,
    };
  },

  getCustomerByPhone: async (phone: string): Promise<CustomerInfo> => {
    await delay(300);
    const customer = customers.find((c) => c.phone === phone);
    if (!customer) {
      throw { statusCode: 404, message: `Customer with phone "${phone}" not found` };
    }
    return { id: customer.id, name: customer.name, phone: customer.phone, points: customer.points };
  },
};
