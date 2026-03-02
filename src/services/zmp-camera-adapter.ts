/**
 * ===== Zalo Mini App Camera Adapter =====
 * Bridges Zalo Mini App Camera API with standard barcode scanning
 * Features:
 * - Permission checking: checkZaloCameraPermission() + requestCameraPermission()
 * - Camera stream via createCameraContext()
 * - Frame extraction for barcode detection (ROI canvas strategy)
 * - Full photo capture via takePhoto() (optional, for full image storage)
 * - Camera list & device selection via getCameraList() + setDeviceId()
 * - No camera restart after capture
 * 
 * Usage:
 *  1. Check permission: checkPermission()
 *  2. Request permission: requestPermission()
 *  3. Create camera context: createCameraStream(videoElement)
 *  4. Start auto-scan: startAutoFrame(cleanup callback)
 *  5. Optional: captureFullPhoto() for full image
 *  6. Stop stream: cleanup()
 */

// ── Zalo Mini App API Types ──
interface ZaloCamera {
  createCameraContext(): CameraContext;
  getCameraList(): Promise<CameraInfo[]>;
  checkZaloCameraPermission(): Promise<{ granted: boolean }>;
  requestCameraPermission(): Promise<{ granted: boolean }>;
}

interface CameraContext {
  startPreview(canvas: HTMLCanvasElement | HTMLVideoElement): void;
  stopPreview(): void;
  updateMediaConstraints(constraints: MediaConstraints): void;
  setDeviceId(deviceId: string): void;
  takePhoto(): Promise<PhotoData>;
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback: (data: any) => void): void;
  getFrameData(): FrameData | null;
}

interface CameraInfo {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
}

interface MediaConstraints {
  width?: number;
  height?: number;
  frameRate?: number;
  facingMode?: 'user' | 'environment';
}

interface PhotoData {
  data: Uint8Array;
  width: number;
  height: number;
  format: string;
}

interface FrameData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// ── Get Zalo Camera API ──
function getZaloCamera(): ZaloCamera | null {
  if (typeof window === 'undefined') return null;
  
  // Try window.zalo or global zmp-sdk
  const zalo = (window as any).zalo;
  if (zalo && zalo.camera) return zalo.camera;
  
  // Fallback: Check if zmp-sdk is available
  try {
    const zmpCamera = (window as any).__ZMP_CAMERA__;
    if (zmpCamera) return zmpCamera;
  } catch {
    // ignore
  }
  
  return null;
}

// ── Check Camera Permission Status ──
export async function checkPermission(): Promise<boolean> {
  try {
    const zaloCamera = getZaloCamera();
    if (!zaloCamera) {
      console.warn('[ZaloCamera] API not available, falling back to getUserMedia');
      return false;
    }
    
    const result = await zaloCamera.checkZaloCameraPermission();
    console.log('[ZaloCamera] Permission check:', result.granted);
    return result.granted;
  } catch (err) {
    console.error('[ZaloCamera] Permission check error:', err);
    return false;
  }
}

// ── Request Camera Permission ──
export async function requestPermission(): Promise<boolean> {
  try {
    const zaloCamera = getZaloCamera();
    if (!zaloCamera) {
      console.warn('[ZaloCamera] API not available, cannot request permission');
      return false;
    }
    
    const result = await zaloCamera.requestCameraPermission();
    console.log('[ZaloCamera] Permission request result:', result.granted);
    
    if (!result.granted) {
      console.error('[ZaloCamera] Camera permission denied by user');
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[ZaloCamera] Permission request error:', err);
    return false;
  }
}

// ── Get Available Cameras ──
export async function getCameraList(): Promise<CameraInfo[]> {
  try {
    const zaloCamera = getZaloCamera();
    if (!zaloCamera) {
      console.warn('[ZaloCamera] API not available');
      return [];
    }
    
    const cameras = await zaloCamera.getCameraList();
    console.log('[ZaloCamera] Cameras available:', cameras);
    return cameras;
  } catch (err) {
    console.error('[ZaloCamera] Get camera list error:', err);
    return [];
  }
}

// ── Global camera context instance ──
let currentCameraContext: CameraContext | null = null;
let currentVideoElement: HTMLVideoElement | HTMLCanvasElement | null = null;

// ── Create and Start Camera Stream ──
export async function createCameraStream(
  videoElement: HTMLVideoElement,
  options?: { deviceId?: string; constraints?: MediaConstraints }
): Promise<{ 
  streamActive: boolean; 
  cameraContext: CameraContext | null;
  fallbackToGetUserMedia: boolean;
}> {
  try {
    const zaloCamera = getZaloCamera();
    
    if (!zaloCamera) {
      console.warn('[ZaloCamera] API not available, will use getUserMedia fallback');
      return { streamActive: false, cameraContext: null, fallbackToGetUserMedia: true };
    }
    
    // Check permission first
    const hasPermission = await checkPermission();
    if (!hasPermission) {
      console.log('[ZaloCamera] No permission, requesting...');
      const granted = await requestPermission();
      if (!granted) {
        return { streamActive: false, cameraContext: null, fallbackToGetUserMedia: false };
      }
    }
    
    // Create camera context
    const context = zaloCamera.createCameraContext();
    
    // Set device if specified
    if (options?.deviceId) {
      context.setDeviceId(options.deviceId);
      console.log(`[ZaloCamera] Device ID set: ${options.deviceId}`);
    }
    
    // Update constraints
    const defaultConstraints: MediaConstraints = {
      width: 1920,
      height: 1440,
      frameRate: 30,
      facingMode: 'environment'
    };
    
    const constraints = { ...defaultConstraints, ...options?.constraints };
    context.updateMediaConstraints(constraints);
    console.log('[ZaloCamera] Constraints applied:', constraints);
    
    // Start preview on video element
    context.startPreview(videoElement);
    console.log('[ZaloCamera] Preview started on video element');
    
    currentCameraContext = context;
    currentVideoElement = videoElement;
    
    return { 
      streamActive: true, 
      cameraContext: context,
      fallbackToGetUserMedia: false 
    };
    
  } catch (err) {
    console.error('[ZaloCamera] Stream creation error:', err);
    return { 
      streamActive: false, 
      cameraContext: null,
      fallbackToGetUserMedia: true 
    };
  }
}

// ── Stop Camera Stream ──
export function stopCameraStream(): void {
  try {
    if (currentCameraContext) {
      currentCameraContext.stopPreview();
      console.log('[ZaloCamera] Preview stopped');
    }
    currentCameraContext = null;
    currentVideoElement = null;
  } catch (err) {
    console.error('[ZaloCamera] Stop stream error:', err);
  }
}

// ── Update Camera Constraints ──
export function updateCameraConstraints(constraints: MediaConstraints): void {
  try {
    if (!currentCameraContext) {
      console.warn('[ZaloCamera] No active camera context');
      return;
    }
    
    currentCameraContext.updateMediaConstraints(constraints);
    console.log('[ZaloCamera] Constraints updated:', constraints);
  } catch (err) {
    console.error('[ZaloCamera] Update constraints error:', err);
  }
}

// ── Switch Camera Device ──
export function switchCamera(deviceId: string): void {
  try {
    if (!currentCameraContext) {
      console.warn('[ZaloCamera] No active camera context');
      return;
    }
    
    currentCameraContext.setDeviceId(deviceId);
    console.log(`[ZaloCamera] Switched to device: ${deviceId}`);
  } catch (err) {
    console.error('[ZaloCamera] Switch camera error:', err);
  }
}

// ── Get Current Frame Data (for barcode scanning) ──
export function getCurrentFrameData(): FrameData | null {
  try {
    if (!currentCameraContext) {
      console.warn('[ZaloCamera] No active camera context');
      return null;
    }
    
    const frameData = currentCameraContext.getFrameData();
    if (!frameData) {
      console.warn('[ZaloCamera] No frame data available');
      return null;
    }
    
    return frameData;
  } catch (err) {
    console.error('[ZaloCamera] Get frame error:', err);
    return null;
  }
}

// ── Create ROI Canvas from Frame Data ──
// Extracts a region of interest (ROI) from frame data for barcode scanning
export function createROICanvas(
  frameData: FrameData,
  roi: { x: number; y: number; width: number; height: number },
  options?: { scale?: number; enhance?: string }
): HTMLCanvasElement | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) {
      console.error('[ZaloCamera] Cannot create canvas context');
      return null;
    }
    
    const scale = options?.scale ?? 1.8;
    
    // Create image data from frame
    const imgData = new ImageData(frameData.data, frameData.width, frameData.height);
    
    // Create temp canvas for source image
    const srcCanvas = document.createElement('canvas');
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) {
      console.error('[ZaloCamera] Cannot create source canvas');
      return null;
    }
    
    srcCanvas.width = frameData.width;
    srcCanvas.height = frameData.height;
    srcCtx.putImageData(imgData, 0, 0);
    
    // Draw ROI with scale
    canvas.width = Math.floor(roi.width * scale);
    canvas.height = Math.floor(roi.height * scale);
    
    ctx.drawImage(
      srcCanvas,
      roi.x, roi.y, roi.width, roi.height,
      0, 0, canvas.width, canvas.height
    );
    
    console.log(`[ZaloCamera] ROI canvas created: ${canvas.width}×${canvas.height}`);
    return canvas;
    
  } catch (err) {
    console.error('[ZaloCamera] Create ROI canvas error:', err);
    return null;
  }
}

// ── Capture Full Photo (optional, not used for decode) ──
export async function captureFullPhoto(): Promise<{
  blob: Blob | null;
  width?: number;
  height?: number;
  error?: string;
}> {
  try {
    if (!currentCameraContext) {
      return { blob: null, error: 'No active camera context' };
    }
    
    console.log('[ZaloCamera] Capturing full photo...');
    const photoData = await currentCameraContext.takePhoto();
    
    if (!photoData) {
      return { blob: null, error: 'takePhoto returned null' };
    }
    
    // Convert Uint8Array to Blob
    const blob = new Blob([photoData.data], { type: 'image/jpeg' });
    console.log(`[ZaloCamera] Full photo captured: ${blob.size} bytes (${photoData.width}×${photoData.height})`);
    
    return { 
      blob,
      width: photoData.width,
      height: photoData.height
    };
    
  } catch (err) {
    console.error('[ZaloCamera] Capture full photo error:', err);
    return { blob: null, error: (err as Error).message };
  }
}

// ── Freeze Frame Data from Video Element (fallback for hybrid mode) ──
export function freezeFrameFromVideo(
  videoElement: HTMLVideoElement,
  format: 'jpeg' | 'png' = 'jpeg',
  quality: number = 0.95
): string | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('[ZaloCamera] Cannot create canvas for frame freeze');
      return null;
    }
    
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    ctx.drawImage(videoElement, 0, 0);
    
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, quality);
    
    console.log(`[ZaloCamera] Frame frozen to data URL (${format}, quality=${quality})`);
    return dataUrl;
    
  } catch (err) {
    console.error('[ZaloCamera] Freeze frame error:', err);
    return null;
  }
}

// ── Check if Zalo Camera API is available ──
export function isZaloCameraAvailable(): boolean {
  return getZaloCamera() !== null;
}

// ── Get Camera Debug Info ──
export function getCameraDebugInfo(): {
  apiAvailable: boolean;
  hasActiveContext: boolean;
  permissionGranted?: boolean;
} {
  return {
    apiAvailable: isZaloCameraAvailable(),
    hasActiveContext: currentCameraContext !== null,
  };
}
