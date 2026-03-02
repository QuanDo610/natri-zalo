/**
 * ===== PATCH: barcode-manage.tsx - Zalo Camera Integration =====
 * Key changes to add Zalo Mini App Camera support:
 * 
 * 1. Import Zalo camera adapter and hybrid functions
 * 2. Add camera permission check on page mount
 * 3. Update handleStartScan to use hybrid camera
 * 4. Add camera list/switching UI
 * 5. Add "Capture Full Photo" option for Zalo API
 * 6. Keep ROI freeze strategy for barcode detection
 */

// ── ADD to imports at top ──
import * as ZaloCamera from '@/services/zmp-camera-adapter';
import {
  startCameraPreviewHybrid,
  startAutoScanFromStream,
  removeAutoScanForElement,
  captureFullPhotoZalo,
  getCameraListForSwitch,
  switchCameraDevice,
  isUsingZaloCamera,
  // ... existing imports
} from '@/services/scanner-enhanced';

// ── ADD to state declarations (inside BarcodeManagePage component) ──
const [cameraList, setCameraList] = useState<Array<{ deviceId: string; label: string }>>([]);
const [selectedCameraId, setSelectedCameraId] = useState<string>('');
const [usingZaloCamera, setUsingZaloCamera] = useState(false);
const [fullPhotoBlob, setFullPhotoBlob] = useState<string | null>(null); // For optional full photo capture

// ── ADD: Check camera permissions on mount (NEW EFFECT) ──
useEffect(() => {
  const checkCameraSetup = async () => {
    console.log('[App] Checking camera setup...');
    
    // 1. Check if Zalo camera is available
    const isZaloAvailable = ZaloCamera.isZaloCameraAvailable();
    console.log('[App] Zalo camera available:', isZaloAvailable);
    
    // 2. Load camera list
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

// ── REPLACE: handleStartScan function ──
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
    
    // ── TRY: Zalo camera with permission check ──
    if (ZaloCamera.isZaloCameraAvailable()) {
      console.log('[Scan] Attempting Zalo camera...');
      
      // Check and request permission
      let hasPermission = await ZaloCamera.checkPermission();
      if (!hasPermission) {
        console.log('[Scan] Requesting Zalo camera permission...');
        hasPermission = await ZaloCamera.requestPermission();
      }
      
      if (hasPermission) {
        console.log('[Scan] Zalo permission granted, creating stream...');
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
          
          // Configure video element
          videoRef.current.setAttribute('playsinline', 'true');
          (videoRef.current as any).style.objectFit = 'contain';
          
          // Wait for stream to stabilize
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Start continuous barcode scanning from stream
          const onBarcodeDetected = (canvas: HTMLCanvasElement, barcode: string) => {
            console.log(`[Zalo] 📸 ROI canvas frozen at detection: ${barcode} (${canvas.width}×${canvas.height})`);
            // Freeze the ROI canvas as captured image (jpeg 0.95)
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const blobUrl = URL.createObjectURL(blob);
                  setCapturedPhoto(blobUrl);
                  console.log(`[Zalo] Captured ROI photo: ${blobUrl.substring(0, 50)}...`);
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
      
      console.log('[Scan] Zalo camera unavailable or denied, falling back to getUserMedia');
    }
    
    // ── FALLBACK: getUserMedia ──
    setUsingZaloCamera(false);
    cleanupRef.current = startCameraPreview(videoRef.current, (err, msg) => {
      setScanState('error');
      setErrorType(err);
      setErrorMessage(msg);
    });
    
    // Wait for camera to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start continuous scan
    const onBarcodeDetected = (canvas: HTMLCanvasElement, barcode: string) => {
      console.log(`[getUserMedia] 📸 ROI canvas frozen: ${barcode} (${canvas.width}×${canvas.height})`);
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

// ── ADD: Handle camera switching ──
const handleSwitchCamera = async (deviceId: string) => {
  setSelectedCameraId(deviceId);
  
  if (usingZaloCamera) {
    switchCameraDevice(deviceId);
    console.log('[Scan] Camera switched to:', deviceId);
  } else {
    console.log('[Scan] Device switching requires restart (will be applied on next scan start)');
  }
};

// ── ADD: Capture optional full photo (Zalo only) ──
const handleCaptureFullPhoto = async () => {
  if (!usingZaloCamera) {
    setErrorMessage('Full photo capture only available with Zalo Mini App Camera API');
    return;
  }
  
  try {
    console.log('[Scan] Capturing full photo from Zalo camera...');
    const result = await captureFullPhotoZalo();
    
    if (result.imageData && !result.error) {
      setFullPhotoBlob(result.imageData);
      console.log(`[Scan] Full photo captured: ${result.width}×${result.height}`);
      setSuccessMessage(`Full photo captured: ${result.width}×${result.height}px`);
    } else {
      setErrorMessage(`Failed to capture full photo: ${result.error}`);
    }
  } catch (err) {
    console.error('[Scan] Full photo capture error:', err);
    setErrorMessage('Error capturing full photo');
  }
};

// ── JSX: ADD camera selection UI (in render section) ──
// Place this somewhere in the camera control section, e.g., after torch toggle
{cameraList.length > 1 && (
  <div className="my-3 flex gap-2 items-center">
    <label className="text-sm font-medium">Camera:</label>
    <select
      value={selectedCameraId}
      onChange={(e) => handleSwitchCamera(e.target.value)}
      disabled={scanState === 'scanning' || scanState === 'previewing'}
      className="px-3 py-2 border rounded text-sm"
    >
      {cameraList.map(camera => (
        <option key={camera.deviceId} value={camera.deviceId}>
          {camera.label || `Camera ${camera.deviceId.substring(0, 8)}`}
        </option>
      ))}
    </select>
    {usingZaloCamera && <span className="text-xs text-blue-600">🟢 Zalo API</span>}
  </div>
)}

// ── JSX: ADD full photo capture button (optional, Zalo only) ──
{usingZaloCamera && scanState === 'previewing' && (
  <Button
    onClick={handleCaptureFullPhoto}
    disabled={scanningPhoto}
    className="w-full mt-2"
  >
    📷 Capture Full Photo (Optional)
  </Button>
)}

// ── JSX: Show full photo if captured ──
{fullPhotoBlob && (
  <div className="mt-3 p-3 border rounded bg-gray-50">
    <p className="text-sm font-medium mb-2">Full Photo (Not used for decode):</p>
    <img src={fullPhotoBlob} alt="Full capture" className="max-w-full h-auto rounded" />
  </div>
)}

// ── ADD: Log camera info in development ──
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Debug] Camera setup:', {
      cameraList: cameraList,
      selectedCamera: selectedCameraId,
      usingZaloCamera: usingZaloCamera,
      zaloAvailable: ZaloCamera.isZaloCameraAvailable(),
    });
  }
}, [cameraList, selectedCameraId, usingZaloCamera]);
