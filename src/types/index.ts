// ===== Shared Types for Natri Loyalty System (v3) =====

export type UserRole = 'ADMIN' | 'STAFF' | 'DEALER' | 'CUSTOMER';
export type BarcodeStatus = 'UNUSED' | 'USED';

export interface DealerInfo {
  id: string;
  code: string;
  name: string;
  phone: string;
  shopName: string;
  address: string | null;
  points: number;
}

export interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  activated: boolean;
  activatedAt: string | null;
}

export interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  points: number;
}

export interface ActivationRequest {
  barcode: string;
  customer: {
    name: string;
    phone: string;
  };
  dealerCode?: string;
}

export interface ActivationResponse {
  activationId: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  customerPointsAfter: number;
  dealerPointsAfter: number | null;
}

export interface ApiError {
  statusCode: number;
  message: string;
}

// ── Auth types ─────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  phone?: string;
  username?: string;
  fullName?: string;
  role: UserRole;
  customerId?: string;
  dealerId?: string;
  customer?: CustomerInfo;
  dealer?: DealerInfo;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface OtpRequestResponse {
  message: string;
  expiresIn: number;
}

// ── Activation history (for customer / dealer) ─────────────────
export interface ActivationHistoryItem {
  id: string;
  pointsAwarded: number;
  createdAt: string;
  product: { name: string; sku: string };
  dealer?: { code: string; name: string; shopName: string } | null;
  customer?: { name: string; phone: string } | null;
  barcodeItem: { barcode: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}

// ── Dealer dashboard stats ─────────────────────────────────────
export interface DealerStats {
  dealer: {
    points: number;
    code: string;
    name: string;
    shopName: string;
  };
  totalActivations: number;
  activationsToday: number;
  activationsWeek: number;
  activationsMonth: number;
  uniqueCustomers: number;
  totalPoints: number;
}

export interface AppState {
  dealerCode: string | null;
  dealerInfo: DealerInfo | null;
  lastActivation: ActivationResponse | null;
  customerName: string;
  customerPhone: string;
}

// ── Barcode management (STAFF/ADMIN) ───────────────────────────
export interface BarcodeItemInfo {
  id: string;
  barcode: string;
  status: BarcodeStatus;
  activated: boolean;
  activatedAt: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  createdBy?: { username: string; fullName: string } | null;
}

export interface CreateBarcodeRequest {
  code: string;
  productSku: string;
}

export interface CreateBarcodeResponse {
  id: string;
  barcode: string;
  product: { name: string; sku: string };
  createdBy?: { username: string; fullName: string } | null;
}

export interface BatchBarcodeResult {
  total: number;
  created: number;
  errors: number;
  details: { code: string; status: 'created' | 'error'; error?: string }[];
}

export interface ProductItem {
  id: string;
  name: string;
  sku: string;
}

// ── Scan-add barcode (camera flow) ─────────────────────────────
export interface ScanAddBarcodeRequest {
  code: string;
}

export interface ScanAddBarcodeResponse {
  id: string;
  code: string;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  status: BarcodeStatus;
  createdAt: string;
  createdBy?: { username: string; fullName: string } | null;
}
