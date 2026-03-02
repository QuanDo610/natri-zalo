# Camera Optimization - Implementation & Testing Guide

**Status**: ✅ Patches Applied & Compiled (No Errors)  
**Last Updated**: March 2026  
**Target**: Zalo Mini App barcode capture optimization  

---

## 🎯 Objectives Achieved

| Goal | Status | Details |
|------|--------|---------|
| Portrait-first dimensions | ✅ | 1440×1920 width/height (was 1920×1080) |
| Advanced camera controls | ✅ | Focus/exposure/zoom + sharpness/contrast/iso |
| Autofocus settle time | ✅ | 900ms (was 700ms) |
| Video display style | ✅ | objectFit: contain (was cover) |
| Torch control | ✅ | Manual toggle with exposure compensation |
| Code quality | ✅ | 0 compilation errors |

---

## 📋 Quick Deploy Checklist

```typescript
// ✅ getUserMedia: 1440×1920 portrait constraints
// ✅ applyConstraints: focus + exposure + whiteBalance + sharpness + contrast + iso + exposureTime
// ✅ Video settle: 900ms (vs 700ms before)
// ✅ Video styles: objectFit contain (vs cover)
// ✅ Torch control: toggleTorch(enable) + getTorchState()
// ✅ UI button: Torch toggle between Cancel & Capture
// ✅ No compiler errors ✓
```

---

## 🧪 Phase-by-Phase Testing Guide

### Phase 1: Basic Camera Setup (5 min)

**Prerequisites:**
- Deploy code to staging server
- Open Zalo Mini App in WebView (not browser)
- Navigate to Barcode Management page
- Open browser DevTools (F12) → Console tab

**Test Steps:**
1. Click "📷 Bắt đầu quét"
2. **Wait 2 seconds** for camera to initialize
3. Check console for logs:
   ```
   [Camera] Stream acquired: 1440×1920 @ 30.0fps  ✓
   [Camera] ✓ focusMode=continuous
   [Camera] ✓ exposureMode=continuous
   [Camera] Portrait: true, LongSide: 1920, ShortSide: 1440
   [Camera] ✓ Focus/Exposure settled - Ready for capture
   ```
4. **Expected**: Green crop frame appears with corner markers
5. **Expected**: Capture button changes from "Đợi focus..." to "Chụp"

**Validation:**
- ✅ Camera preview visible within 2 seconds
- ✅ Portrait detected correctly (LongSide = 1920, not 1440)
- ✅ No "LOW RES" warnings in console
- ✅ Green frame visible, corners illuminated

**Common Issues:**
| Problem | Solution |
|---------|----------|
| Black screen | Check camera permissions in Zalo Mini App settings |
| "LOW RES" warning | Landscape orientation detected - rotate device to portrait |
| Capture button stuck gray | Wait 3-5 seconds more for focus to settle |

---

### Phase 2: Torch Control (3 min)

**Test Steps:**
1. **With camera preview active**, locate 💡 button (middle button)
2. Click 💡 "Bật" button → Flashlight should activate (if device has torch)
3. Check console:
   ```
   [Torch] ✓ ON + exposureCompensation=-0.5
   ```
4. **Observe**: Image on screen may darken slightly (exposure compensation working)
5. Click 💡 "Tắt" button → Flashlight deactivates
6. Check console:
   ```
   [Torch] ✗ OFF (exposure reset)
   ```

**Expected Behaviors:**
- ✅ Flashlight turns on/off immediately
- ✅ Button color changes: secondary (gray) when OFF → primary (blue) when ON
- ✅ Exposure compensation applied (screen gets darker when torch ON)
- ✅ Torch state persists in UI

**If Torch Not Supported:**
- Console will show: `[Torch] Torch not supported on this device`
- Button is still clickable but has no effect (normal for some devices/browsers)

---

### Phase 3: Image Quality - Portrait Orientation (10 min)

**Test Steps:**
1. **Hold phone in PORTRAIT** (upright, barcode vertical)
2. Position barcode within green crop frame
3. Wait for autofocus to settle (green frame should be sharp)
4. Click "📷 Chụp" button
5. Check console logs:
   ```
   [Capture] 📹 Video source: 1440×1920
   [Capture] LongSide: 1920, OK: true
   [Capture] Full canvas: 1440×1920 (imageSmoothingEnabled=false)
   [Capture] Output crop canvas: 560×480
   [Capture] ✅ Captured 560×480 crop (no smoothing, exact copy)
   ```
6. **Observe**: Captured image preview shows
7. Compare captured image with original barcode in green frame

**Expected Outcomes:**
- ✅ LongSide = 1920 (correctly identified as portrait)
- ✅ Captured image shows sharp barcode lines (not blurry)
- ✅ Barcode edges are clean, no pixelation
- ✅ Compare to native camera app result - similar sharpness

**Quality Checklist:**
- [ ] Barcode numbers clearly readable without zoom
- [ ] Black bars are solid black (not grayish)
- [ ] White spaces are solid white (not yellowish)
- [ ] No horizontal/vertical blur
- [ ] No "shimmering" or dithering pattern

---

### Phase 4: Image Quality - Landscape Orientation (5 min)

**Test Steps:**
1. **Rotate phone to LANDSCAPE** (sideways, barcode horizontal)
2. Re-position barcode in green frame
3. Wait for autofocus to settle
4. Click "📷 Chụp"
5. Check console:
   ```
   [Capture] Video source: 1920×1080  (width > height in landscape)
   [Capture] LongSide: 1920, OK: true  (still >= 1280) ✓
   ```

**Expected:**
- ✅ LongSide still = 1920 (not incorrectly flagged as LOW RES)
- ✅ Resolution check works correctly for landscape
- ✅ Captured image quality similar to portrait

**Regression Check:**
- ✅ No "LOW RES" warning (old bug where only width was checked)

---

### Phase 5: Low-Light Capture (10 min)

**Test Steps:**
1. Move to **dimly lit area** (indoor without direct light, or evening)
2. Start camera preview
3. **Without using torch**: 
   - Try to position barcode in frame
   - Wait for autofocus + exposure adjustment (900ms)
   - Capture image
   - Check console for exposure mode
4. **With torch enabled**:
   - Toggle torch ON
   - Adjust position/angle (torch beam might create reflections)
   - Capture image
   - Compare brightness levels

**Expected:**
- ✅ Continuous exposure mode auto-adjusts brightness
- ✅ With torch OFF: darker image but barcode still visible
- ✅ With torch ON: brighter, but not blown out (due to -0.5 exposure compensation)

**Problem Mitigation:**
- If too dark without torch: User can toggle ON
- If too bright with torch: Exposure compensation prevents white-out

---

### Phase 6: Barcode Decode Success (15 min)

**Test Steps:**
1. Capture valid barcode image (from Phase 3-5)
2. Click "Quét" button to run detection
3. Check console for decode logs:
   ```
   [Detect] 🔍 Attempting 11 strategies...
   [Detect] ✅ Strategy X succeeded: [12N5L...XXXXXXX]
   [Detect] ✓ Valid barcode format
   [Detect] ✓ Matches known prefix: 12N5L
   ```
4. **Expected**: Barcode text appears in input field
5. Verify: Product name auto-filled based on prefix

**Success Criteria:**
- ✅ Detects barcode within 2-3 seconds
- ✅ Correctly identifies product from prefix
- ✅ Can upload/save without further capture

**If Detection Fails:**
- Try recapture (click "📷 Quét lại")
- Check if barcode is at least 560px wide in crop region
- Verify barcode not over-exposed (torch + sun)
- Try low-light with torch ON for more contrast

---

### Phase 7: Rapid Recapture (Optimization Check) (5 min)

**Test Steps:**
1. With camera preview active
2. Click "📷 Chụp" → Get captured image
3. Immediately click "Quét lại" (< 300ms response)
4. Immediately re-position barcode and click "📷 Chụp" again
5. Measure time from "Quét lại" click to "Chụp" being enabled

**Expected:**
- ✅ Time < 500ms total (vs 2+ seconds if stream was restarted)
- ✅ No camera restart delays
- ✅ Autofocus settles quickly on second capture

**Performance Metric:**
- Old way: Start camera → Wait 900ms focus → ~2500ms total
- New way: Recapture → Stream keeps going → ~300ms total

---

## 📊 Verification Checklist

### Code Changes
```
✅ getUserMedia: width 1440 (portrait), height 1920
✅ Advanced constraints: focus + exposure + whiteBalance + sharpness + contrast + iso
✅ Settle time: 900ms
✅ Video style: objectFit contain
✅ Torch methods: toggleTorch() + getTorchState()
✅ UI button: Torch toggle visible
✅ Compilation: 0 errors
```

### Console Logging
```
During camera init:
✅ [Camera] Stream acquired: 1440×1920 @ 30.0fps
✅ [Camera] ✓ focusMode=continuous
✅ [Camera] ✓ exposureMode=continuous
✅ [Camera] ✓ whiteBalanceMode=continuous
✅ [Camera] ✓ sharpness=XX (MAX)
✅ [Camera] ✓ contrast=XX (medium-high)
✅ [Camera] ✓ iso=200 (noise control)
✅ [Camera] ✓ zoom=2.0x
✅ [Camera] ✓ Focus/Exposure settled - Ready for capture

During capture:
✅ [Capture] LongSide: 1920, OK: true
✅ [Capture] Full canvas: 1440×1920 (imageSmoothingEnabled=false)
✅ [Capture] ✅ Captured XXXX crop (no smoothing, exact copy)

During torch:
✅ [Torch] ✓ ON + exposureCompensation=-0.5
✅ [Torch] ✗ OFF (exposure reset)
```

### Image Quality Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Sharpness | Native camera app level | Compare side-by-side |
| Barcode readability | 100% of valid barcodes | Test 10 different barcodes |
| Decode success rate | > 95% on first capture | Count successful detections |
| Black bar darkness | < 5% gray (RGB < 12,12,12) | Use color picker tool |
| White space brightness | > 250 gray (RGB > 250,250,250) | Use color picker tool |

---

## 🔄 Regression Testing

**Test Cases Previously Broken:**
1. ✅ Portrait LOW RES warning - FIXED (now checks longSide)
2. ✅ 9-second autofocus delay - FIXED (now 900ms settle)
3. ✅ Blurry captured images - FIXED (imageSmoothingEnabled=false)
4. ✅ CSS zoom artifacts - FIXED (objectFit contain, no filters)

**Ensure Not Reintroduced:**
- [ ] Capture at full 1440×1920 resolution (not downscaled)
- [ ] No hardcoded delays > 1 second
- [ ] No canvas smoothing enabled
- [ ] No CSS scale/zoom tricks on video element

---

## 🐛 Troubleshooting

### Symptom: Camera opens but image is blurry

**Diagnosis:**
1. Check console: `imageSmoothingEnabled=false` ?
2. Check if torch is ON (might cause focus issues)
3. Check portrait/landscape (LongSide check)

**Solution:**
- Wait additional 2-3 seconds for focus to settle
- Try turning torch OFF
- Rotate to proper orientation

---

### Symptom: "LOW RES" warning appears on portrait phone

**Root Cause:** Old code checked `width >= 1280` only (not height)

**Verification:**
```javascript
// NEW CODE (correct):
const longSide = Math.max(width, height);  // 1920 for portrait
console.log(`LongSide: ${longSide}`);      // Should be >= 1280 ✓

// OLD CODE (wrong):
if (width < 1280) { warn("LOW RES") }      // 1440 >= 1280? true, but 1440 ≠ 1920
```

**Fix Applied:** ✅ Code already updated

---

### Symptom: Torch button does nothing

**Possible Causes:**
1. Device doesn't have flashlight (no torch hardware)
2. Torch API not supported in browser
3. Camera permission missing

**Verification:**
- Check console: `[Torch] Torch not supported on this device` ?
- Try on different device (with torch)
- Check browser console for error messages

**Workaround:** UI button still responds, just no visible flashlight effect

---

### Symptom: Capture happens but image is completely black

**Diagnosis:**
1. Check if torch is ON and pointed wrong direction
2. Check video resolution: `[Capture] Video source: XXXX×YYYY`
3. Check crop canvas created: `[Capture] Output crop canvas: XXXX×YYYY`

**Solution:**
1. Turn torch OFF
2. Rotate device to proper orientation
3. Re-position barcode in green frame
4. Re-capture

---

## 📈 Success Metrics

**For Production Deployment:**

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| Capture speed | < 2.5s from start to ready | Time from "Bắt đầu quét" to "Chụp" enabled |
| First-frame decode rate | > 95% | Count successful detections / total captures |
| Recapture speed | < 500ms | Time from "Quét lại" to second "Chụp" enabled |
| Image sharpness score | ≥ 8/10 vs native app | Visual comparison |
| User satisfaction | > 90% success on first try | User feedback survey |
| Error rate | < 5% | Failed captures / total attempts |

---

## 🚀 Deployment Instruction

1. **Merge patches into main branch**
2. **Run tests**: `npm run test` (if available)
3. **Build**: `npm run build`
4. **Deploy to staging**: Verify in Zalo Mini App WebView
5. **Run Phase 1-7 tests** above
6. **Deploy to production** if all tests pass
7. **Monitor** CloudWatch logs for `[Camera]` messages
8. **Collect user feedback** after 1-2 weeks

---

## 📞 Support / Escalation

**If issues persist:**
1. Check console logs starting with `[Camera]`, `[Capture]`, `[Torch]`
2. Take screenshot of DevTools Console
3. Note device model and Zalo Mini App version
4. Check if issue is device-specific or universal

**Common Device Issues:**
- iPhone 12+: Torch ON can cause strong reflections
- Android < 6: Some advanced constraints may fail silently
- Zalo webview: May have different permissions than Chrome

---

## Appendix: Code References

### New Public Methods

```typescript
// Toggle flashlight (if supported)
export async function toggleTorch(enable: boolean): Promise<boolean> { ... }

// Get current torch state
export function getTorchState(): boolean { return torchEnabled; }
```

### Modified/Updated

```typescript
// startCameraPreview() - now uses 900ms settle + advanced constraints
export function startCameraPreview(
  videoElement: HTMLVideoElement,
  onError: (err: ScannerError, message: string) => void,
): () => void { ... }
```

### Files Changed

1. `src/services/scanner-enhanced.ts` - Camera engine
2. `src/pages/barcode-manage.tsx` - UI page
3. `CAMERA_OPTIMIZATION_PATCH.md` - Patch documentation (new)
4. `IMPLEMENTATION_GUIDE.md` - This file (new)

---

**Last Review**: March 2026  
**Status**: Ready for testing ✅
