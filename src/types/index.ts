// ===== Shared Types for Natri Loyalty System =====

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

export interface AppState {
  dealerCode: string | null;
  dealerInfo: DealerInfo | null;
  lastActivation: ActivationResponse | null;
  customerName: string;
  customerPhone: string;
}
