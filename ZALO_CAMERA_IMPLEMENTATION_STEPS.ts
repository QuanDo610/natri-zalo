// ===== CONCRETE IMPLEMENTATION GUIDE FOR scanner-enhanced.ts =====
// Step-by-step code modifications with exact locations
//
// STEP 1: Add import at TOP of file (after existing imports)
// ──────────────────────────────────────────────────────────

/*
File: src/services/scanner-enhanced.ts
After line ~12 (after existing imports), ADD:

    import * as ZaloCamera from './zmp-camera-adapter';
*/


// STEP 2: Add global state variables (after existing module-level variables)
// ──────────────────────────────────────────────────────────────────────────

/*
File: src/services/scanner-enhanced.ts
After line ~90 (after SCANNER_VERSION, Quagga declarations), ADD:

    // ── Zalo Mini App Camera Integration ──
    let useZaloCamera = false;
    let zaloFrameUpdateInterval: ReturnType<typeof setInterval> | null = null;
    let frameBuffer: HTMLCanvasElement | null = null;
*/


// STEP 3: Rename existing startCameraPreview (line ~789)
// ────────────────────────────────────────────────────

/*
File: src/services/scanner-enhanced.ts
Line ~789: Find this:

    export function startCameraPreview(

Change to:

    function startCameraPreviewGetUserMedia(

(This makes it private; we'll create a new public wrapper)
*/


// STEP 4: Add new public startCameraPreview wrapper
// ──────────────────────────────────────────────────

/*
File: src/services/scanner-enhanced.ts
After the startCameraPreviewGetUserMedia() function, ADD this new export:

    // ── Hybrid wrapper: Try Zalo first, fall back to getUserMedia ──
    export function startCameraPreview(
      videoElement: HTMLVideoElement,
      onError: (err: ScannerError, message: string) => void,
    ): () => void {
      const cleanupFunctions: Array<() => void> = [];
      
      (async () => {
        try {
          console.log('[Camera] Attempting Zalo Mini App Camera API...');
          
          if (ZaloCamera.isZaloCameraAvailable()) {
            const hasPermission = await ZaloCamera.checkPermission();
            
            if (!hasPermission) {
              console.log('[Camera] Requesting Zalo camera permission...');
              const granted = await ZaloCamera.requestPermission();
              
              if (!granted) {
                console.log('[Camera] Permission denied, using getUserMedia fallback');
                startCameraPreviewGetUserMedia(videoElement, onError);
                return;
              }
            }
            
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
              
              startZaloFramePolling(videoElement);
              
              videoElement.setAttribute('playsinline', 'true');
              videoElement.setAttribute('disablepictureinpicture', 'true');
              (videoElement as any).style.objectFit = 'contain';
              (videoElement as any).style.objectPosition = 'center';
              
              cleanupFunctions.push(() => {
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
              });
              
              return; // Successfully initialized with Zalo
            }
          }
          
          // Fallback to getUserMedia
          console.log('[Camera] Using getUserMedia fallback');
          useZaloCamera = false;
          startCameraPreviewGetUserMedia(videoElement, onError);
          
        } catch (err: any) {
          console.error('[Camera] Hybrid initialization error:', err);
          onError('UNKNOWN_ERROR', err.message);
        }
      })();
      
      return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
      };
    }
*/


// STEP 5: Add frame polling helper
// ─────────────────────────────────

/*
File: src/services/scanner-enhanced.ts
After the startCameraPreview function, ADD:

    // ── Zalo frame polling: Extract frames for seamless integration ──
    function startZaloFramePolling(videoElement: HTMLVideoElement): void {
      if (zaloFrameUpdateInterval) {
        clearInterval(zaloFrameUpdateInterval);
      }
      
      zaloFrameUpdateInterval = setInterval(() => {
        try {
          const frameData = ZaloCamera.getCurrentFrameData();
          if (!frameData) return;
          
          if (!frameBuffer) {
            frameBuffer = document.createElement('canvas');
            frameBuffer.width = frameData.width;
            frameBuffer.height = frameData.height;
          }
          
          const ctx = frameBuffer.getContext('2d');
          if (!ctx) return;
          
          const imgData = new ImageData(frameData.data, frameData.width, frameData.height);
          ctx.putImageData(imgData, 0, 0);
          
        } catch (err) {
          console.warn('[Camera] Frame polling error:', err);
        }
      }, 100);
    }
*/


// STEP 6: Add utility functions (at end of file before exports)
// ──────────────────────────────────────────────────────────────

/*
File: src/services/scanner-enhanced.ts
Before the last line (exports), ADD:

    // ── Additional Zalo Camera Utilities ──
    
    export async function getCameraListForSwitch(): Promise<Array<{ deviceId: string; label: string }>> {
      if (!useZaloCamera) {
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
      
      const cameras = await ZaloCamera.getCameraList();
      return cameras
        .filter(c => c.kind === 'videoinput')
        .map(c => ({ deviceId: c.deviceId, label: c.label }));
    }
    
    export function switchCameraDevice(deviceId: string): void {
      if (useZaloCamera) {
        ZaloCamera.switchCamera(deviceId);
        console.log(`[Camera] Switched to device: ${deviceId}`);
      }
    }
    
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
    
    export function isUsingZaloCamera(): boolean {
      return useZaloCamera;
    }
*/


// ===== NO CHANGES NEEDED FOR: =====
// ─────────────────────────────────
//
// startAutoScanFromStream()
// - ROI canvas extraction works with both getUserMedia and Zalo
// - No modifications needed
// - Frame comes from video element in both cases
//
// captureAndDecode()
// - No changes needed
// - Works with video element as-is
//
// decodeFromImageFile()
// - No changes needed
// - Independent of camera source
//
// All barcode detection and validation logic
// - No changes needed


// ===== CHANGES FOR barcode-manage.tsx =====
// ──────────────────────────────────────────

/*
File: src/pages/barcode-manage.tsx

1. ADD imports:
   
   import * as ZaloCamera from '@/services/zmp-camera-adapter';
   import { getCameraListForSwitch, switchCameraDevice, captureFullPhotoZalo, isUsingZaloCamera } from '@/services/scanner-enhanced';

2. ADD state (in BarcodeManagePage component, with other state):
   
   const [cameraList, setCameraList] = useState<Array<{ deviceId: string; label: string }>>([]);
   const [selectedCameraId, setSelectedCameraId] = useState<string>('');
   const [usingZaloCamera, setUsingZaloCamera] = useState(false);
   const [fullPhotoBlob, setFullPhotoBlob] = useState<string | null>(null);

3. ADD effect (on mount, check camera setup):
   
   useEffect(() => {
     const checkCameraSetup = async () => {
       console.log('[App] Checking camera setup...');
       const isZaloAvailable = ZaloCamera.isZaloCameraAvailable();
       console.log('[App] Zalo camera available:', isZaloAvailable);
       
       try {
         const cameras = await getCameraListForSwitch();
         setCameraList(cameras);
         if (cameras.length > 0) {
           setSelectedCameraId(cameras[0].deviceId);
         }
       } catch (err) {
         console.warn('[App] Could not load camera list:', err);
       }
     };
     
     checkCameraSetup();
   }, []);

4. UPDATE handleStartScan function (find and replace):
   
   BEFORE: Just calls startCameraPreview()
   AFTER:  Includes Zalo permission check and stream creation
   
   const handleStartScan = async () => {
     if (scanState !== 'idle') return;
     
     setScanState('previewing');
     setErrorMessage('');
     setErrorType(null);
     setSuccessMessage('');
     
     try {
       if (!videoRef.current) {
         setScanState('error');
         setErrorType('UNKNOWN');
         setErrorMessage('Không thể khởi tạo camera.');
         return;
       }
       
       console.log('[Scan] Starting camera preview...');
       
       // Try Zalo camera API first
       if (ZaloCamera.isZaloCameraAvailable()) {
         console.log('[Scan] Attempting Zalo camera...');
         
         let hasPermission = await ZaloCamera.checkPermission();
         if (!hasPermission) {
           console.log('[Scan] Requesting permission...');
           hasPermission = await ZaloCamera.requestPermission();
         }
         
         if (hasPermission) {
           const result = await ZaloCamera.createCameraStream(videoRef.current, {
             deviceId: selectedCameraId || undefined,
             constraints: {
               width: 1920,
               height: 1440,
               frameRate: 30,
             }
           });
           
           if (result.streamActive) {
             setUsingZaloCamera(true);
             console.log('[Scan] ✅ Using Zalo Mini App Camera API');
             
             videoRef.current.setAttribute('playsinline', 'true');
             (videoRef.current as any).style.objectFit = 'contain';
             
             await new Promise(resolve => setTimeout(resolve, 1500));
             
             const onBarcodeDetected = (canvas: HTMLCanvasElement, barcode: string) => {
               console.log(`[Zalo] 📸 ROI frozen at detection: ${barcode}`);
               canvas.toBlob(
                 (blob) => {
                   if (blob) {
                     const blobUrl = URL.createObjectURL(blob);
                     setCapturedPhoto(blobUrl);
                   }
                 },
                 'image/jpeg',
                 0.95
               );
             };
             
             cleanupRef.current = startAutoScanFromStream(videoRef.current, (barcode: string) => {
               setScannedBarcode(barcode);
               const parsed = parseBarcodePrefix(barcode);
               setInferredProduct(parsed);
               setScanState('scanned');
             }, {
               intervalMs: 400,
               onBarcodeDetected,
             });
             
             return;
           }
         }
         
         console.log('[Scan] Zalo unavailable, falling back to getUserMedia');
       }
       
       // Fallback: getUserMedia
       setUsingZaloCamera(false);
       cleanupRef.current = startCameraPreview(videoRef.current, (err, msg) => {
         setScanState('error');
         setErrorType(err);
         setErrorMessage(msg);
       });
       
       await new Promise(resolve => setTimeout(resolve, 2000));
       
       const onBarcodeDetected = (canvas: HTMLCanvasElement, barcode: string) => {
         console.log(`[getUserMedia] 📸 ROI frozen`);
         canvas.toBlob(
           (blob) => {
             if (blob) {
               const blobUrl = URL.createObjectURL(blob);
               setCapturedPhoto(blobUrl);
             }
           },
           'image/jpeg',
           0.95
         );
       };
       
       cleanupRef.current = startAutoScanFromStream(videoRef.current, (barcode: string) => {
         setScannedBarcode(barcode);
         const parsed = parseBarcodePrefix(barcode);
         setInferredProduct(parsed);
         setScanState('scanned');
       }, {
         intervalMs: 400,
         onBarcodeDetected,
       });
       
     } catch (err) {
       console.error('[Scan] Error:', err);
       setScanState('error');
       setErrorType('UNKNOWN');
       setErrorMessage((err as Error).message || 'Không thể khởi tạo camera.');
     }
   };

5. ADD camera switch handler:
   
   const handleSwitchCamera = async (deviceId: string) => {
     setSelectedCameraId(deviceId);
     if (usingZaloCamera) {
       switchCameraDevice(deviceId);
     }
   };

6. ADD full photo handler:
   
   const handleCaptureFullPhoto = async () => {
     if (!usingZaloCamera) {
       setErrorMessage('Full photo only available with Zalo camera');
       return;
     }
     
     try {
       const result = await captureFullPhotoZalo();
       if (result.imageData && !result.error) {
         setFullPhotoBlob(result.imageData);
         setSuccessMessage(`Full photo: ${result.width}×${result.height}px`);
       } else {
         setErrorMessage(`Failed: ${result.error}`);
       }
     } catch (err) {
       setErrorMessage('Error capturing full photo');
     }
   };

7. ADD UI for camera selection (in JSX, camera control section):
   
   {cameraList.length > 1 && (
     <div className="my-3 flex gap-2 items-center">
       <label className="text-sm font-medium">Camera:</label>
       <select
         value={selectedCameraId}
         onChange={(e) => handleSwitchCamera(e.target.value)}
         disabled={scanState === 'scanning' || scanState === 'previewing'}
         className="px-3 py-2 border rounded text-sm"
       >
         {cameraList.map(cam => (
           <option key={cam.deviceId} value={cam.deviceId}>
             {cam.label || `Camera`}
           </option>
         ))}
       </select>
       {usingZaloCamera && <span className="text-xs text-blue-600">🟢 Zalo API</span>}
     </div>
   )}

8. ADD full photo button (optional, Zalo only):
   
   {usingZaloCamera && scanState === 'previewing' && (
     <Button onClick={handleCaptureFullPhoto} className="w-full mt-2">
       📷 Capture Full Photo
     </Button>
   )}

9. ADD full photo display:
   
   {fullPhotoBlob && (
     <div className="mt-3 p-3 border rounded bg-gray-50">
       <p className="text-sm font-medium mb-2">Full Photo:</p>
       <img src={fullPhotoBlob} alt="Full" className="max-w-full h-auto" />
     </div>
   )}
*/


// ===== QUICK VERIFICATION CHECKLIST =====
// ────────────────────────────────────────
//
// After implementation, verify:
//
// [] NEW FILES EXIST:
//    └─ src/services/zmp-camera-adapter.ts
//
// [] SCANNER-ENHANCED.TS MODIFIED:
//    ✓ Import added: import * as ZaloCamera
//    ✓ Global state added: useZaloCamera, zaloFrameUpdateInterval, frameBuffer
//    ✓ startCameraPreview renamed to startCameraPreviewGetUserMedia
//    ✓ New startCameraPreview() wrapper created (hybrid logic)
//    ✓ startZaloFramePolling() helper added
//    ✓ Utility functions added (getCameraListForSwitch, etc)
//    ✓ Export functions added to module.exports
//
// [] BARCODE-MANAGE.TSX MODIFIED:
//    ✓ Zalo camera imports added
//    ✓ New state variables added
//    ✓ Permission check effect added
//    ✓ handleStartScan updated with Zalo logic
//    ✓ handleSwitchCamera handler added
//    ✓ handleCaptureFullPhoto handler added
//    ✓ Camera UI added to JSX
//    ✓ Full photo display added to JSX
//
// [] RUNTIME TEST:
//    ✓ No TypeScript errors
//    ✓ Page loads without console errors
//    ✓ Camera tab opens
//    ✓ Check console for "[Camera] Attempting Zalo..." or fallback message
//    ✓ Camera preview appears in video element
//    ✓ QR/barcode scanning works
