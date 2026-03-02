/**
 * ===== PATCH: Zalo Mini App Camera Integration =====
 * Add this at the TOP of scanner-enhanced.ts (after existing imports)
 */

import * as ZaloCamera from './zmp-camera-adapter';

// ── Flag: Use Zalo API if available, fall back to getUserMedia ──
let useZaloCamera = false;
let zaloFrameUpdateInterval: ReturnType<typeof setInterval> | null = null;
let frameBuffer: HTMLCanvasElement | null = null;

// ── Hybrid startCameraPreview with Zalo API support ──
/**
 * PATCH: Replace or wrap the existing startCameraPreview function
 * Now supports both Zalo Mini App Camera API and fallback to getUserMedia
 */
export function startCameraPreviewHybrid(
  videoElement: HTMLVideoElement,
  onError: (err: ScannerError, message: string) => void,
): () => void {
  const cleanupFunctions: Array<() => void> = [];
  
  (async () => {
    try {
      // ── Try Zalo Camera API first ──
      console.log('[Camera] Attempting Zalo Mini App Camera API...');
      
      if (ZaloCamera.isZaloCameraAvailable()) {
        // Check permission
        const hasPermission = await ZaloCamera.checkPermission();
        
        if (!hasPermission) {
          console.log('[Camera] Requesting Zalo camera permission...');
          const granted = await ZaloCamera.requestPermission();
          
          if (!granted) {
            console.log('[Camera] Zalo camera permission denied, falling back to getUserMedia');
            // Fall through to getUserMedia
          } else {
            // Permission granted, create stream
            const result = await ZaloCamera.createCameraStream(videoElement, {
              constraints: {
                width: 1920,
                height: 1440,
                frameRate: 30,
                facingMode: 'environment'
              }
            });
            
            if (result.streamActive && result.cameraContext) {
              useZaloCamera = true;
              console.log('[Camera] ✅ Zalo Camera API initialized');
              
              // Set up frame polling for consistent frame extraction
              startZaloFramePolling(videoElement);
              
              // ── PATCH: Configure video element for optimal rendering ──
              videoElement.setAttribute('playsinline', 'true');
              videoElement.setAttribute('disablepictureinpicture', 'true');
              (videoElement as any).style.objectFit = 'contain';
              (videoElement as any).style.objectPosition = 'center';
              
              const cleanup = () => {
                console.log('[Camera] Cleaning up Zalo camera...');
                if (zaloFrameUpdateInterval) {
                  clearInterval(zaloFrameUpdateInterval);
                  zaloFrameUpdateInterval = null;
                }
                if (frameBuffer) {
                  frameBuffer = null;
                }
                ZaloCamera.stopCameraStream();
                useZaloCamera = false;
              };
              
              cleanupFunctions.push(cleanup);
              return; // Success with Zalo, don't fall back
            }
          }
        }
      }
      
      // ── Fallback: Use traditional getUserMedia ──
      console.log('[Camera] Using getUserMedia fallback');
      useZaloCamera = false;
      
      // Call the existing getUserMedia implementation
      // This is the original startCameraPreview logic
      startCameraPreviewGetUserMedia(videoElement, onError);
      
    } catch (err) {
      console.error('[Camera] Hybrid initialization error:', err);
      onError('UNKNOWN_ERROR', `Lỗi khởi tạo camera: ${(err as Error).message}`);
    }
  })();
  
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
}

// ── Helper: Frame polling for Zalo camera ──
function startZaloFramePolling(videoElement: HTMLVideoElement): void {
  if (zaloFrameUpdateInterval) {
    clearInterval(zaloFrameUpdateInterval);
  }
  
  zaloFrameUpdateInterval = setInterval(() => {
    try {
      const frameData = ZaloCamera.getCurrentFrameData();
      if (!frameData) return;
      
      // Create frame buffer canvas if not exists
      if (!frameBuffer) {
        frameBuffer = document.createElement('canvas');
        frameBuffer.width = frameData.width;
        frameBuffer.height = frameData.height;
      }
      
      const ctx = frameBuffer.getContext('2d');
      if (!ctx) return;
      
      // Create ImageData from frame
      const imgData = new ImageData(frameData.data, frameData.width, frameData.height);
      ctx.putImageData(imgData, 0, 0);
      
    } catch (err) {
      console.warn('[Camera] Frame polling error:', err);
    }
  }, 100); // Poll every 100ms
}

// ── Original: getUserMedia implementation (rename existing) ──
function startCameraPreviewGetUserMedia(
  videoElement: HTMLVideoElement,
  onError: (err: ScannerError, message: string) => void,
): () => void {
  // This is the existing startCameraPreview implementation
  // Just use the original function logic
  const cleanup = () => {
    stopScan();
    if (currentPreviewStream) {
      currentPreviewStream.getTracks().forEach((t) => t.stop());
      currentPreviewStream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
      try {
        videoElement.pause();
      } catch {
        // ignore
      }
    }
  };

  if (
    typeof window !== 'undefined' &&
    window.location.protocol !== 'https:' &&
    !window.location.hostname.includes('localhost') &&
    window.location.hostname !== '127.0.0.1'
  ) {
    onError(
      'HTTPS_REQUIRED',
      'Camera yêu cầu HTTPS. Vui lòng truy cập qua HTTPS hoặc localhost.',
    );
    return cleanup;
  }

  (async () => {
    try {
      if (currentPreviewStream) {
        currentPreviewStream.getTracks().forEach((t) => t.stop());
        currentPreviewStream = null;
      }
      
      if (videoElement.srcObject) {
        try {
          videoElement.pause();
        } catch {
          // ignore
        }
        videoElement.srcObject = null;
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const constraintChain = getOptimalVideoConstraints('4:3');
      let stream: MediaStream | null = null;
      let selectedConstraint: string = '';
      
      for (const constraint of constraintChain) {
        try {
          console.log(`[Camera] Trying constraint: ${constraint.label}`);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: constraint.video,
          });
          selectedConstraint = constraint.label;
          console.log(`[Camera] ✓ Acquired stream: ${selectedConstraint}`);
          break;
        } catch (err: any) {
          console.log(`[Camera] ✗ ${constraint.label} failed: ${err.message}`);
        }
      }
      
      if (!stream) {
        throw new Error('All constraint attempts failed');
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        stream.getTracks().forEach(t => t.stop());
        onError('UNKNOWN_ERROR', 'Không thể lấy video track từ stream');
        return;
      }
      
      const streamSettings = videoTrack.getSettings();
      const streamWidth = streamSettings.width || 0;
      const streamHeight = streamSettings.height || 0;
      const streamFps = streamSettings.frameRate || 0;
      const streamAspect = (streamWidth / streamHeight).toFixed(2);
      
      const qualityCheck = checkStreamQuality(streamSettings);
      const longSide = Math.max(streamWidth, streamHeight);
      const shortSide = Math.min(streamWidth, streamHeight);
      const isPortrait = streamHeight > streamWidth;
      
      console.log(`[Camera] Stream acquired: ${streamWidth}×${streamHeight} @ ${streamFps.toFixed(1)}fps (aspect=${streamAspect})`);
      console.log(`[Camera] Constraint: ${selectedConstraint}`);
      console.log(`[Camera] Quality: ${qualityCheck.reason}`);
      console.log(`[Camera] Portrait: ${isPortrait}, LongSide: ${longSide}, ShortSide: ${shortSide}`);
      
      if (!qualityCheck.ok) {
        console.warn(`[Camera] ⚠️ Stream quality issue: ${qualityCheck.reason}`);
      }
      
      if (!videoElement) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      
      currentPreviewStream = stream;
      videoElement.srcObject = stream;
      
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('disablepictureinpicture', 'true');
      (videoElement as any).style.backfaceVisibility = 'hidden';
      (videoElement as any).style.WebkitBackfaceVisibility = 'hidden';
      (videoElement as any).style.filter = 'none';
      (videoElement as any).style.objectFit = 'contain';
      (videoElement as any).style.objectPosition = 'center';
      (videoElement as any).style.WebkitFontSmoothing = 'antialiased';
      (videoElement as any).style.textRendering = 'geometricPrecision';
      (videoElement as any).style.lineHeight = '0';
      (videoElement as any).style.fontSize = '0';
      
      try {
        await videoElement.play();
      } catch (playError: any) {
        if (playError.name === 'AbortError') {
          console.log('[Camera] Play aborted, retrying...');
          await new Promise(resolve => setTimeout(resolve, 200));
          await videoElement.play();
        } else {
          throw playError;
        }
      }
      
      const maxRetries = 30;
      let retries = 0;
      while (retries < maxRetries && (videoElement.readyState < 2 || videoElement.videoWidth === 0)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (videoElement.readyState < 2 || videoElement.videoWidth === 0) {
        throw new Error('Video did not reach HAVE_CURRENT_DATA state');
      }
      
      const vw = videoElement.videoWidth;
      const vh = videoElement.videoHeight;
      const vLong = Math.max(vw, vh);
      const vOk = vLong >= 1280;
      console.log(`[Camera] Video ready: ${vw}×${vh} (longSide=${vLong})`);
      console.log(`[Camera] Video quality OK: ${vOk}`);
      
      await applyAdvancedConstraints(videoTrack);
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      (videoElement as any).dataset.focusLocked = 'true';
      console.log('[Camera] ✅ Focus/Exposure settled - Ready for capture');
    } catch (error: any) {
      console.error('[Camera] Preview error:', error);
      currentPreviewStream = null;
      
      if (error.name === 'NotAllowedError') {
        onError('PERMISSION_DENIED', 'Quyền camera bị từ chối');
      } else if (error.name === 'NotFoundError') {
        onError('NO_CAMERA', 'Không tìm thấy camera');
      } else {
        onError('UNKNOWN_ERROR', `Lỗi camera: ${error.message}`);
      }
    }
  })();

  return cleanup;
}

// ── Hybrid: Get ROI Canvas from Zalo or video element ──
export function getROICanvasFromStream(
  videoElement: HTMLVideoElement,
  roi: { x: number; y: number; width: number; height: number },
  options?: { scale?: number; enhance?: string }
): HTMLCanvasElement | null {
  if (useZaloCamera && frameBuffer) {
    // Try to create ROI from Zalo frame
    const frameData = ZaloCamera.getCurrentFrameData();
    if (frameData) {
      return ZaloCamera.createROICanvas(frameData, roi, options);
    }
  }
  
  // Fallback: Create ROI from video element
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) return null;
  
  const scale = options?.scale ?? 1.8;
  canvas.width = Math.floor(roi.width * scale);
  canvas.height = Math.floor(roi.height * scale);
  
  ctx.drawImage(
    videoElement,
    roi.x, roi.y, roi.width, roi.height,
    0, 0, canvas.width, canvas.height
  );
  
  return canvas;
}

// ── Capture Full Photo with Zalo API (optional) ──
export async function captureFullPhotoZalo(): Promise<{
  imageData: string;
  width?: number;
  height?: number;
  error?: string;
}> {
  if (!useZaloCamera) {
    return { imageData: '', error: 'Not using Zalo camera' };
  }
  
  const result = await ZaloCamera.captureFullPhoto();
  
  if (!result.blob) {
    return { imageData: '', error: result.error };
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        imageData: (e.target?.result as string) || '',
        width: result.width,
        height: result.height,
      });
    };
    reader.onerror = () => {
      resolve({ imageData: '', error: 'FileReader error' });
    };
    reader.readAsDataURL(result.blob);
  });
}

// ── Get Available Cameras for Switching ──
export async function getCameraListForSwitch(): Promise<Array<{ deviceId: string; label: string }>> {
  if (!useZaloCamera) {
    // Fall back to browser enumeration
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({ deviceId: device.deviceId, label: device.label }));
    } catch (err) {
      console.warn('Cannot enumerate devices:', err);
      return [];
    }
  }
  
  // Use Zalo API
  const cameras = await ZaloCamera.getCameraList();
  return cameras
    .filter(c => c.kind === 'videoinput')
    .map(c => ({ deviceId: c.deviceId, label: c.label }));
}

// ── Switch Camera Device ──
export function switchCameraDevice(deviceId: string): void {
  if (useZaloCamera) {
    ZaloCamera.switchCamera(deviceId);
    console.log(`[Camera] Switched to device: ${deviceId}`);
  } else {
    // For getUserMedia, would need to restart stream
    console.warn('[Camera] Device switching requires stream restart (not implemented for getUserMedia yet)');
  }
}

// ── Check if using Zalo camera ──
export function isUsingZaloCamera(): boolean {
  return useZaloCamera;
}
