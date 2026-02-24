// ===== Barcode Scanner wrapper =====
// Uses ZMP SDK scanQRCode when available, falls back to manual input

/**
 * Attempt to scan barcode using ZMP SDK.
 * Returns the scanned barcode string, or null if cancelled/unavailable.
 */
export async function scanBarcode(): Promise<string | null> {
  try {
    // Dynamic import to avoid crash when SDK not available
    const { scanQRCode } = await import('zmp-sdk');
    const result = await scanQRCode({});
    if (result && typeof result === 'object' && 'content' in result) {
      return (result as any).content || null;
    }
    return typeof result === 'string' ? result : null;
  } catch (err) {
    console.warn('Barcode scan not available, use manual input:', err);
    return null;
  }
}

/**
 * Validate barcode format: 8-20 digits
 */
export function isValidBarcode(barcode: string): boolean {
  return /^\d{8,20}$/.test(barcode);
}

/**
 * Validate Vietnamese phone number
 */
export function isValidPhone(phone: string): boolean {
  return /^0(3|5|7|8|9)\d{8}$/.test(phone);
}
