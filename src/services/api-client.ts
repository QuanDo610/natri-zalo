// ===== API Client with mock mode support =====

import type {
  DealerInfo,
  ProductInfo,
  ActivationRequest,
  ActivationResponse,
  CustomerInfo,
} from '@/types';
import { mockApi } from '@/services/mock-service';

const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';
const MOCK_MODE = (import.meta as any).env?.VITE_MOCK_MODE === 'true' || true; // default mock=true

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Network error' }));
    throw {
      statusCode: res.status,
      message: error.message || `HTTP ${res.status}`,
    };
  }

  return res.json();
}

// ===== Real API =====
const realApi = {
  lookupDealer: (code: string): Promise<DealerInfo> =>
    request('GET', `/dealers/lookup?code=${encodeURIComponent(code)}`),

  findProductByBarcode: (barcode: string): Promise<ProductInfo> =>
    request('GET', `/products/by-barcode/${encodeURIComponent(barcode)}`),

  createActivation: (data: ActivationRequest): Promise<ActivationResponse> =>
    request('POST', '/activations', data),

  getCustomerByPhone: (phone: string): Promise<CustomerInfo> =>
    request('GET', `/customers/by-phone/${encodeURIComponent(phone)}`),
};

// ===== Exported API (switches between mock and real) =====
export const api = MOCK_MODE ? mockApi : realApi;
export default api;
