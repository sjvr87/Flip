# Android camera quality (flagship targets)

**Requirement:** Android capture quality must not diminish in-app, especially on flagship phones (reference device: **Samsung Galaxy S26 Ultra**). Treat native Samsung Camera 4K60 + OIS as the benchmark; in-app capture should not look noticeably worse for the same scene.

## Current stack

| Layer | Implementation |
|-------|----------------|
| Create tab (Android) | `src/app/(tabs)/create.android.tsx` → `FlipCameraScreen.android.tsx` |
| Native module | `modules/flip-camerawesome` (Expo module, CameraX 1.4.2) |
| Config (JS) | `src/camera/camerawesome/config.ts` → `FLIP_ANDROID_CAPTURE` |
| Native session | `FlipCameraSession.kt` |
| iOS (comparison) | `react-native-vision-camera` in `create.ios.tsx` — **not used on Android** |
| Upload pipeline | `caption.tsx` → `react-native-compressor` → Loops REST `studio/upload` (ATProto video upload not wired yet) |

## Configured capture profile (today)

| Setting | Value | Where |
|---------|-------|-------|
| Resolution | **1080p FHD** (1920×1080) | `Quality.FHD` in `FlipCameraSession.kt`; capped — no 4K path |
| Target FPS | **60** (fixed `Range(60, 60)` via Camera2 interop) | Preview + video capture |
| Video bitrate | **12 Mbps** | `VIDEO_BITRATE` / `setTargetVideoEncodingBitRate` |
| Codec | **H.264 (AVC)** — CameraX default; **no HEVC/H.265** configured | Implicit |
| Audio | **AAC** — default when `withAudioEnabled()` | Implicit |
| Stabilization | **OIS + EIS requested** (`LENS_OPTICAL_STABILIZATION_MODE_ON`, `CONTROL_VIDEO_STABILIZATION_MODE_ON`, `setVideoStabilizationEnabled(true)`) | Preview + record; hardware may ignore on unsupported lenses |
| HDR | **Not enabled** — standard AE only (`CONTROL_AE_MODE_ON`) | No HDR10/HDR video profile |
| Exposure | Flagship tuning: ~35% negative EV compensation on bind | `applyFlagshipExposureProfile()` |
| Preview | 1920×1080 target, `PreviewView` PERFORMANCE mode, FILL_CENTER | Separate from recorder quality selector |
| Recording | Same session; FHD quality selector with fallback **not above FHD** | `FallbackStrategy.higherQualityOrLowerThan(Quality.FHD)` |
| Max duration | 180 s | `MAX_RECORDING_SECONDS` |
| Zoom | 1×–10× via `setZoomRatio` (software / CameraX fusion; **no explicit ultra-wide / telephoto lens picker**) | UI + native |
| Gallery upload | `expo-image-picker` with `allowsEditing: true`, aspect 9:16, `quality: 1` | May crop/re-encode before preview |

## S26 Ultra hardware (benchmark)

Typical Ultra-class capabilities (S24/S25/S26 Ultra class):

- Main sensor: high-resolution (200 MP class), **OIS**, large pixels
- Video: **4K @ 60 fps**, often **8K @ 30 fps** on native camera
- **HDR10+** video, advanced multi-frame NR, scene-adaptive processing
- **Multi-camera**: ultra-wide, wide (1×), telephoto (3× / 5× optical)
- High encoder bitrates in native app (often 50–100+ Mbps for 4K)

## Gaps vs native / risks for S26 Ultra

### Capture (in-app record)

1. **Hard 1080p cap** — `Quality.FHD` + fallback strategy never selects UHD/4K. S26 Ultra records 4K60 natively; in-app is capped at 1080p60. **Largest quality gap.**
2. **12 Mbps bitrate** — Reasonable for 1080p60, but native 4K often uses 4–8× higher. Even at 1080p, Samsung's native encoder may use higher bitrate + better tuning.
3. **No HEVC** — Native camera often offers HEVC for better quality at same bitrate; app uses AVC only.
4. **No HDR video** — Native HDR10+ not requested; highlights/dynamic range may look flatter in bright scenes (partially mitigated by EV compensation).
5. **Single logical camera** — No `physicalDevices` equivalent; zoom >1× may be digital crop rather than optical telephoto switch (unlike iOS `create.ios.tsx` which requests ultra-wide / wide / telephoto).
6. **60 fps fallback** — If 1080p60 fails on a device, CameraX may drop FPS; no runtime surfacing of actual profile to UI (badge always says "1080p60 · OIS").
7. **OIS/EIS requests may be no-ops** — Camera2 interop options are best-effort; front camera and some modes won't stabilize.

### Upload path (post-capture)

8. **`react-native-compressor` re-encode** — `caption.tsx` runs `compressionMethod: 'auto'`, `maxSize: 1920` before upload. **Second quality loss** even if capture were 4K. Caps long edge at 1920 and lets compressor pick bitrate.
9. **Gallery path** — `allowsEditing: true` + 9:16 crop can discard pixels and re-encode before upload.
10. **Upload target** — Still Loops REST API, not ATProto `video.bsky.app` blob pipeline; server-side transcoding unknown.

## Quality targets (future work)

Use these when extending capture or ATProto upload:

| Target | Flagship goal | Notes |
|--------|---------------|-------|
| Resolution | **4K (3840×2160) @ 60 fps** on supported devices | Add `Quality.UHD`, device capability probe, fallback to FHD60 |
| Bitrate | **40–50 Mbps @ 4K60**, **12–18 Mbps @ 1080p60** | Expose in `FLIP_ANDROID_CAPTURE` + `FlipCameraSession` |
| Codec | **HEVC when available**, H.264 fallback | CameraX / device support check |
| Lenses | **Optical zoom steps** (0.5× / 1× / 3× / 5×) via CameraX zoom or physical camera selection | Mirror iOS multi-`physicalDevices` approach |
| HDR | Evaluate **HDR10** only if preview + upload chain supports it | High complexity |
| Upload | **Skip or lighten compression** when source ≤ target; or compress with explicit min bitrate | Guard ATProto size limits separately |
| Telemetry | **`getCaptureProfile()` should report actual** resolution, fps, codec, bitrate after bind | Helps validate on S26 Ultra |

## Files to touch for improvements

- `modules/flip-camerawesome/android/.../FlipCameraSession.kt` — resolution, bitrate, codec, lens selection
- `src/camera/camerawesome/config.ts` — JS-side constants (keep in sync with native)
- `src/app/private/camera/caption.tsx` — upload compression policy
- `src/camera/FlipCameraScreen.android.tsx` — UI badge / capability display

## Validation checklist (S26 Ultra)

- [ ] Log actual CameraX profile after bind (resolution, fps, codec, bitrate)
- [ ] Side-by-side: native Samsung Camera 4K60 vs Flip in-app record (same lighting, 1× zoom)
- [ ] Compare before/after `react-native-compressor` pass (ffmpeg metadata or MediaInfo)
- [ ] Test telephoto: 3×/5× optical vs in-app pinch/slide zoom
- [ ] Test walking/handheld (OIS/EIS effectiveness)
- [ ] Test gallery upload path without `allowsEditing` for full-res imports
