/**
 * ===== ZALO MINI APP CAMERA INTEGRATION GUIDE =====
 * Complete technical implementation for migrating from getUserMedia to Zalo Mini App Camera API
 * 
 * ## What Was Created
 * 
 * 1. zmp-camera-adapter.ts
 *    - Core adapter for Zalo Mini App Camera API
 *    - Permission checking: checkPermission(), requestPermission()
 *    - Stream creation: createCameraStream()
 *    - Frame extraction: getCurrentFrameData(), createROICanvas()
 *    - Full photo: captureFullPhoto()
 *    - Camera switching: getCameraList(), switchCamera()
 * 
 * 2. scanner-enhanced-zalo-patch.ts
 *    - Hybrid camera initialization with fallback
 *    - Frame polling mechanism
 *    - ROI canvas extraction for barcode scanning
 *    - Camera switching utilities
 * 
 * 3. barcode-manage-zalo-patch.tsx
 *    - Page-level integration examples
 *    - Permission workflow
 *    - Camera UI controls
 *    - Full photo capture option
 * 
 * ## Integration Steps
 * 
 * ### STEP 1: Import Zalo Camera in scanner-enhanced.ts
 * ─────────────────────────────────────────────────────
 * 
 * At the TOP of scanner-enhanced.ts (after existing imports), add:
 * 
 *     import * as ZaloCamera from './zmp-camera-adapter';
 * 
 * 
 * ### STEP 2: Add Global Variables for Zalo State
 * ────────────────────────────────────────────────
 * 
 * After imports, add:
 * 
 *     // ── Zalo Camera Integration ──
 *     let useZaloCamera = false;
 *     let zaloFrameUpdateInterval: ReturnType<typeof setInterval> | null = null;
 *     let frameBuffer: HTMLCanvasElement | null = null;
 * 
 * 
 * ### STEP 3: Replace startCameraPreview() function
 * ──────────────────────────────────────────────────
 * 
 * The existing startCameraPreview() should be wrapped with hybrid logic.
 * Rename the existing one to startCameraPreviewGetUserMedia()
 * Create new startCameraPreview() that:
 *   1. Tries Zalo API first
 *   2. Checks permissions using checkPermission() + requestPermission()
 *   3. Creates stream with createCameraStream()
 *   4. Falls back to getUserMedia if Zalo unavailable or denied
 *   5. Returns cleanup function
 * 
 * See: scanner-enhanced-zalo-patch.ts (lines with startCameraPreviewHybrid)
 * 
 * 
 * ### STEP 4: Update startAutoScanFromStream()
 * ────────────────────────────────────────────
 * 
 * KEEP the existing implementation mostly unchanged!
 * The ROI canvas + barcode detection logic already works with:
 * - getUserMedia (via video element)
 * - Zalo API (via frame buffer from polling)
 * 
 * The key: Use video element as-is. Zalo API writes frames to it seamlessly.
 * 
 * 
 * ### STEP 5: Update barcode-manage.tsx
 * ─────────────────────────────────────
 * 
 * a) Add imports:
 *     import * as ZaloCamera from '@/services/zmp-camera-adapter';
 *     import { getCameraListForSwitch, switchCameraDevice, captureFullPhotoZalo, isUsingZaloCamera } ...
 * 
 * b) Add state:
 *     const [cameraList, setCameraList] = useState<Array<...>>([]);
 *     const [selectedCameraId, setSelectedCameraId] = useState<string>('');
 *     const [usingZaloCamera, setUsingZaloCamera] = useState(false);
 *     const [fullPhotoBlob, setFullPhotoBlob] = useState<string | null>(null);
 * 
 * c) Add permission check effect on mount:
 *     useEffect(() => {
 *       const checkCameraSetup = async () => {
 *         const cameras = await getCameraListForSwitch();
 *         setCameraList(cameras);
 *         if (cameras.length > 0) setSelectedCameraId(cameras[0].deviceId);
 *       };
 *       checkCameraSetup();
 *     }, []);
 * 
 * d) Update handleStartScan():
 *     - Check if Zalo available: ZaloCamera.isZaloCameraAvailable()
 *     - Request permission: await ZaloCamera.requestPermission()
 *     - Create stream: await ZaloCamera.createCameraStream()
 *     - Fall back to getUserMedia if needed
 *     - Keep startAutoScanFromStream() call unchanged
 *     - Set usingZaloCamera flag
 * 
 * e) Add camera UI:
 *     - Camera selection dropdown (if multiple cameras)
 *     - Switch handler: handleSwitchCamera()
 *     - Full photo button (Zalo only): handleCaptureFullPhoto()
 * 
 *     Example:
 *       {cameraList.length > 1 && (
 *         <select value={selectedCameraId} onChange={(e) => handleSwitchCamera(e.target.value)}>
 *           {cameraList.map(cam => <option key={cam.deviceId} value={cam.deviceId}>{cam.label}</option>)}
 *         </select>
 *       )}
 * 
 *       {usingZaloCamera && scanState === 'previewing' && (
 *         <Button onClick={handleCaptureFullPhoto}>📷 Capture Full Photo</Button>
 *       )}
 * 
 * 
 * ## Architecture Overview
 * ═══════════════════════════════════════════════════════════════════
 * 
 * ┌─────────────────────────────────────────┐
 * │    barcode-manage.tsx (Page)            │
 * │  ┌─────────────────────────────────────┐│
 * │  │ UI: Camera select, torch, capture   ││
 * │  │ State: cameraList, usingZaloCamera  ││
 * │  └─────────────────────────────────────┘│
 * │         ↓                               │
 * └─────────────────────────────────────────┘
 *         ↓
 * ┌─────────────────────────────────────────┐
 * │ scanner-enhanced.ts                     │
 * │ ┌─────────────────────────────────────┐│
 * │ │ startCameraPreview(hybrid mode)     ││
 * │ │ ├─ Try: Zalo API ────→ Permission   ││
 * │ │ │                   ├─ Stream        ││
 * │ │ │                   └─ Frame polling ││
 * │ │ └─ Fallback: getUserMedia          ││
 * │ │                                    ││
 * │ │ startAutoScanFromStream()          ││
 * │ │ ├─ ROI crop from video element     ││
 * │ │ ├─ Frame enhancement               ││
 * │ │ └─ ZXing/Quagga decode             ││
 * │ └─────────────────────────────────────┘│
 * └─────────────────────────────────────────┘
 *         ↓
 * ┌─────────────────────────────────────────┐
 * │ zmp-camera-adapter.ts                   │
 * │ ┌─────────────────────────────────────┐│
 * │ │ Zalo Mini App Camera API wrapper    ││
 * │ │ ├─ checkPermission()                ││
 * │ │ ├─ requestPermission()              ││
 * │ │ ├─ createCameraStream()             ││
 * │ │ ├─ getCurrentFrameData()            ││
 * │ │ ├─ createROICanvas()                ││
 * │ │ ├─ captureFullPhoto()               ││
 * │ │ └─ getCameraList() / switchCamera() ││
 * │ └─────────────────────────────────────┘│
 * └─────────────────────────────────────────┘
 *         ↓
 * ┌─────────────────────────────────────────┐
 * │ Zalo Mini App Camera API (zmp-sdk)      │
 * │ window.zalo.camera.createCameraContext()│
 * │  ├─ startPreview()                      │
 * │  ├─ updateMediaConstraints()            │
 * │  ├─ takePhoto()                         │
 * │  ├─ setDeviceId()                       │
 * │  └─ getFrameData()                      │
 * └─────────────────────────────────────────┘
 * 
 * 
 * ## Key Features Explained
 * ═════════════════════════════════════════════════════════════════
 * 
 * 1. PERMISSION WORKFLOW
 * ─────────────────────
 *    Before creating stream:
 *       1. checkPermission() - check current state
 *       2. If not granted, requestPermission() - show dialog
 *       3. If still not granted, fall back to getUserMedia
 *    
 *    Benefits:
 *    - Respects Zalo mini app permission system
 *    - Graceful degradation if permission denied
 *    - Single permission flow (not every time user scans)
 * 
 * 
 * 2. HYBRID CAMERA INITIALIZATION
 * ───────────────────────────────
 *    Try order:
 *       1. Zalo Camera API (if available + permitted)
 *       2. userMedia fallback (always available on HTTPS/localhost)
 *    
 *    Benefits:
 *    - Better performance on Zalo Mini App (native API, better optimization)
 *    - Works everywhere else (web browsers)
 *    - Zero friction device switching (Zalo has device list)
 * 
 * 
 * 3. ROI + FREEZE CAPTURE
 * ──────────────────────
 *    Current flow (UNCHANGED from current code):
 *       1. startAutoScanFromStream() polls video element
 *       2. Each frame: crop ROI region (center box ~70% of frame)
 *       3. Apply enhancement (grayscale, contrast, binary, etc.)
 *       4. Try decode with ZXing/Quagga
 *       5. On decode success: freeze ROI canvas to blob (jpeg 0.95)
 *       6. Store as capturedPhoto for user confirmation
 *    
 *    Zalo Integration:
 *       - Zalo frames are automatically rendered to video element
 *       - ROI extraction still works (same DOM coordinates)
 *       - No changes needed to barcode detection logic
 *    
 *    Benefits:
 *    - Accurate barcode capture (ROI only, high quality)
 *    - User sees exactly what was scanned
 *    - Full quality preserved (no downsampling)
 * 
 * 
 * 4. OPTIONAL FULL PHOTO
 * ──────────────────────
 *    Zalo API only feature:
 *       - captureFullPhoto() calls cameraContext.takePhoto()
 *       - Returns full device camera image (not used for decode)
 *       - Optional button: user can save full photo if desired
 *       - Separate from ROI capture (ROI has priority for decode)
 *    
 *    Benefits:
 *    - Users can optionally get full photo
 *    - Barcode decode still uses high-quality ROI
 *    - No camera restart needed after capture
 * 
 * 
 * 5. CAMERA SWITCHING
 * ───────────────────
 *    Available in both modes:
 *       - getCameraList() - get available cameras (Zalo or enumerateDevices)
 *       - switchCamera(deviceId) - switch camera (Zalo only, requires restart for getUserMedia)
 *       - UI: dropdown showing all cameras (if multiple available)
 *    
 *    Limitations:
 *       - Zalo: Instant switch via setDeviceId()
 *       - getUserMedia: Requires stream restart (not auto-switched in current code)
 * 
 * 
 * ## Migration Path
 * ═════════════════════════════════════════════════════════════════
 * 
 * Phase 1: DEVELOPMENT (Optional)
 * ─────────────────────────────────
 *    - Deploy on Zalo mini app test VM
 *    - Verify Zalo API available and integrated
 *    - Test permission workflow
 *    - Verify frame polling accuracy
 * 
 * 
 * Phase 2: BROWSER TESTING (Optional)
 * ────────────────────────────────────
 *    - Test hybrid fallback to getUserMedia
 *    - Verify barcode detection still works
 *    - Confirm no performance regression
 * 
 * 
 * Phase 3: PRODUCTION
 * ──────────────────
 *    - Deploy to Zalo mini app
 *    - Monitor user feedback
 *    - Collect metrics: scan success, camera errors, device info
 * 
 * 
 * ## Testing Checklist
 * ════════════════════════════════════════════════════════════════
 * 
 * ☐ Permission Workflow
 *   ☐ First launch: permission request shows
 *   ☐ Deny: falls back to getUserMedia gracefully
 *   ☐ Accept: Zalo camera starts
 *   ☐ Second launch: no permission prompt (cached)
 * 
 * ☐ Camera Stream
 *   ☐ Zalo camera preview appears in video element
 *   ☐ ROI frame rendered correctly
 *   ☐ Focus locks after 2-3 seconds
 *   ☐ No black screen or lag
 * 
 * ☐ Barcode Detection
 *   ☐ Real-time scanning works (Zalo)
 *   ☐ ROI canvas freezes on detection
 *   ☐ capturedPhoto blob URL created
 *   ☐ Detected barcode shown in UI
 *   ☐ Fallback scanning (getUserMedia) also works
 * 
 * ☐ Camera Controls
 *   ☐ Torch toggle works (if supported)
 *   ☐ Camera list populated (if multi-camera device)
 *   ☐ Camera switching works (Zalo)
 *   ☐ Full photo button works (Zalo only)
 * 
 * ☐ Error Handling
 *   ☐ Permission denied: clear error message
 *   ☐ No camera: clear error message
 *   ☐ HTTPS required (web): clear error message
 *   ☐ Zalo API unavailable: graceful fallback
 *   ☐ Frame polling errors: logged but don't crash
 * 
 * ☐ Performance
 *   ☐ No memory leaks from frame polling
 *   ☐ No excessive CPU usage
 *   ☐ Frame rate stable (30fps target)
 *   ☐ Barcode decode latency < 500ms
 * 
 * ☐ Edge Cases
 *   ☐ Rapid scan/stop/scan cycle
 *   ☐ Page unload during scan
 *   ☐ Browser tab background/foreground
 *   ☐ Screen rotation (if applicable)
 * 
 * 
 * ## Troubleshooting
 * ═══════════════════════════════════════════════════════════════
 * 
 * Q: Zalo camera not detected
 * A: 1. Check if running on actual Zalo mini app (not browser)
 *    2. Check console: isZaloCameraAvailable() should return true
 *    3. Verify zmp-sdk is loaded: window.zalo?.camera should exist
 * 
 * Q: Permission request not showing
 * A: 1. Check if permission already granted (use checkPermission())
 *    2. Try resetZaloAppData in dev tools
 *    3. Check Zalo app settings > Permissions > Camera
 * 
 * Q: Blank dark screen on startPreview()
 * A: 1. Wait for focus settling (2-3 seconds)
 *    2. Check if video element has proper CSS (objectFit: contain)
 *    3. Verify startPreview() called with correct video element ref
 *    4. Check browser console for errors
 * 
 * Q: Barcode not detected in real-time
 * A: 1. Barcode must be in ROI center region (70% of frame center)
 *    2. Try moving barcode closer/farther
 *    3. Check frame quality (use zoom if available)
 *    4. Try manual capture if auto-scan fails
 *    5. Check console: look for enhancement strategies tried
 * 
 * Q: Full photo capture not working
 * A: 1. Only available with Zalo camera (check usingZaloCamera flag)
 *    2. Not available during scan (need to stop scan first)
 *    3. Check browser console for errors
 *    4. Some Zalo devices might not support takePhoto()
 * 
 * Q: Frame polling lag or memory leak
 * A: 1. Check zaloFrameUpdateInterval cleared on cleanup
 *    2. Check frameBuffer canvas released
 *    3. Monitor memory in DevTools (heap snapshots)
 *    4. Reduce polling interval if needed (currently 100ms)
 * 
 * 
 * ## Performance Tips
 * ════════════════════════════════════════════════════════════════
 * 
 * 1. Frame Polling
 *    - Currently 100ms interval (0.1s) = 10 FPS frame updates
 *    - Barcode scan runs at 400ms interval (separate from frame polling)
 *    - Adjust if frame latency is issue: startZaloFramePolling()
 * 
 * 2. ROI Canvas Size
 *    - Larger ROI = slower decode but better detection
 *    - Current: ~70% of frame width (adaptive based on device res)
 *    - Upscale factor: 1.8x for better barcode clarity
 *    - Adjust in startAutoScanFromStream: cropRegions upscale values
 * 
 * 3. Enhancement Strategies
 *    - Current: 6 enhancement modes rotated through
 *    - Each mode tried on every scan frame
 *    - Slower but more efficient (better coverage, no retry)
 *    - Reduce to speed up: modify enhancements array in startAutoScanFromStream
 * 
 * 4. Reader Instance Creation
 *    - Fresh readers created per-frame decode (prevents cache issues)
 *    - trade: memory for reliability
 *    - Can reuse if problematic (but may need debugging)
 * 
 * 
 * ## Files Summary
 * ═══════════════════════════════════════════════════════════════
 * 
 * NEW FILES:
 * - src/services/zmp-camera-adapter.ts (400+ lines)
 *   Core adapter for Zalo Mini App Camera API
 *
 * PATCH FILES (reference implementations):
 * - src/services/scanner-enhanced-zalo-patch.ts (400+ lines)
 *   Shows how to integrate hybrid camera logic into scanner-enhanced.ts
 *
 * - src/pages/barcode-manage-zalo-patch.tsx (200+ lines)
 *   Shows integration points in the barcode management page
 *
 * EXISTING FILES (no changes required):
 * - src/services/scanner-enhanced.ts
 *   Keep existing ROI + barcode detection code unchanged
 *   Just wrap startCameraPreview() with hybrid logic
 *
 * - src/pages/barcode-manage.tsx
 *   Add permission check, camera list, integrate hybrid flow
 * 
 * 
 * ## Deployment Notes
 * ════════════════════════════════════════════════════════════════
 * 
 * 1. zmp-sdk must be in package.json (already is: "zmp-sdk": "latest")
 * 
 * 2. No additional npm packages needed for this integration
 * 
 * 3. TypeScript definitions:
 *    - zmp-camera-adapter.ts has full inline types for Zalo API
 *    - No @types packages needed
 * 
 * 4. Browser support:
 *    - Zalo: Works on all Zalo mini app platforms
 *    - Web fallback: HTTPS required (except localhost)
 *    - Mobile browser: getUserMedia fallback works fine
 * 
 * 5. Build optimization:
 *    - zmp-camera-adapter export can be tree-shaken if not using Zalo
 *    - Imports are minimal, no heavy dependencies
 * 
 */

// This file is documentation only - copy code from scanner-enhanced-zalo-patch.ts
// and barcode-manage-zalo-patch.tsx to implement
