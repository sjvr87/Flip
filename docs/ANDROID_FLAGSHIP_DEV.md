# Android flagship dev (Samsung Galaxy S26 Ultra)

Flip reference device for native camera and Android QA. **Do not use Expo Go** — use the Flip dev build (`social.flip.app`).

**Related docs**

| Doc | Purpose |
|-----|---------|
| [DEV_BUILD_ANDROID.md](./DEV_BUILD_ANDROID.md) | First-time SDK, Gradle, env vars, full troubleshooting |
| [ANDROID_STUDIO_PLUGINS.md](./ANDROID_STUDIO_PLUGINS.md) | Kotlin/Gradle bundled; optional ADB Idea |
| [CAMERA.md](./CAMERA.md) | 1080p60 in-app vs 4K native Samsung camera |

---

## Quick start (S26 Ultra)

```powershell
cd C:\Users\tomas\Documents\Flip
.\flip-check-env.bat          # verify node, adb, device, Metro, JDK
.\flip-dev.bat                # git pull + adb + Metro + LAN deep link
```

| Situation | Run |
|-----------|-----|
| JS/TS only | `flip-reload.bat` or hot reload |
| App won't connect / stale Metro | `flip-reset-dev.bat` |
| USB replug / crash | `flip-reconnect.bat` or `flip-connect.bat` |
| Native / camera Kotlin change | `npm run android:dev` |
| First time (no `android/`) | `npm run android:dev:setup` |

Daily workflow is **Cursor + `flip-*.bat`**. Open **Android Studio** for Kotlin edits, Gradle sync, and Logcat.

---

## Samsung Developer options

1. **Settings → About phone → Software information** → tap **Build number** 7×.
2. **Settings → Developer options** — enable:
   - **USB debugging**
   - **Install via USB** (helps sideloading debug APKs)
   - **Stay awake** (screen on while charging — useful during long debug sessions)
3. Plug in USB → **Allow USB debugging** → optionally **Always allow from this computer**.
4. Notification shade → USB → **File transfer / MTP** (not charge-only).

---

## Device ID and `FLIP_ADB_DEVICE`

This project's dev scripts prefer the S26 Ultra serial:

```
R3GL10HN64A
```

Set permanently if you use multiple adb devices:

```powershell
[System.Environment]::SetEnvironmentVariable("FLIP_ADB_DEVICE", "R3GL10HN64A", "User")
```

`scripts/dev-connect.ps1` uses `FLIP_ADB_DEVICE` when set; otherwise defaults to `R3GL10HN64A`.

Verify connection:

```powershell
adb devices
# R3GL10HN64A    device
```

---

## USB + same Wi-Fi for Metro

Flip dev deep links use your PC **LAN IP** (`exp://192.168.x.x:8081`), not `127.0.0.1`. Phone and PC must be on the **same Wi-Fi** even when USB is connected.

| Layer | What happens |
|-------|----------------|
| USB | `adb reverse tcp:8081 tcp:8081` (fallback path) |
| Wi-Fi | LAN deep link from `flip-dev.bat` / `flip-reset-dev.bat` |
| Metro | One window on port **8081** — taskbar title **Flip Metro** |

**`flip-reset-dev.bat`** — nuclear reset when the app won't connect, crashes on launch, or the dev launcher shows broken servers. Kills stale Metro, clears cache, sets adb reverse, launches LAN deep link (bypasses expo-dev-client picker).

**`flip-dev.bat`** — normal start: git pull, adb prep, reuse healthy Metro or start one window, launch with LAN deep link.

Deep link format (from `dev-connect.ps1`):

```text
flip://expo-development-client/?url=exp%3A%2F%2F192.168.x.x%3A8081
```

Metro must say **Using development build** — not Expo Go.

---

## When to native rebuild

Re-run **`npm run android:dev`** (alias for `android:build`) when:

| Change | Rebuild? |
|--------|----------|
| JS/TS/React only | No — `flip-reload.bat` |
| `modules/flip-camerawesome` Kotlin | **Yes** |
| `app.json` plugins / native config | **Yes** |
| New npm package with native code | **Yes** |
| `expo-dev-client` added/changed | **Yes** |

After rebuild: `flip-connect.bat` or `flip-dev.bat`.

---

## Camera: Flip vs native Samsung app

See **[CAMERA.md](./CAMERA.md)** for the full quality audit.

| | Flip in-app (CameraX) | Samsung Camera app |
|--|----------------------|-------------------|
| Resolution | **1080p FHD** (hard cap) | **4K** (and 8K on Ultra) |
| FPS | **60** target | 60 @ 4K |
| Codec | H.264 AVC | Often HEVC + HDR10+ |
| Stabilization | OIS + EIS requested | Full Samsung pipeline |

In-app capture is **1080p60 · OIS** — good for social video, but not pixel-matched to native 4K. Future work: 4K path on flagship devices (tracked in CAMERA.md).

Create tab requires the **Flip dev build** — Expo Go shows a placeholder.

When the camera preview is active, Android shows a **green privacy dot** in the status bar (camera in use). No dot usually means the preview did not bind — check Logcat below.

---

## Logcat filters

In Android Studio **Logcat**, or from terminal:

```powershell
adb logcat -s FlipCamerawesome FlipCameraSession
```

Useful tags (Kotlin module `flip-camerawesome`):

| Tag | What it logs |
|-----|----------------|
| `FlipCamerawesome` | View lifecycle, layout defer, bind retries, permission |
| `FlipCameraSession` | CameraX bind, quality selector, record start/stop |

Broader Flip / React Native:

```powershell
adb logcat -s FlipCamerawesome FlipCameraSession ReactNativeJS ExpoModulesCore
```

Clear log before reproducing:

```powershell
adb logcat -c
```

---

## Troubleshooting (S26 Ultra)

### Black camera preview

Recent fixes in `FlipCamerawesomeView.kt`:

- **COMPATIBLE** `PreviewView` implementation (TextureView) — avoids black preview on Samsung + RN hierarchies.
- **Defer bind until layout** — waits for non-zero root/preview size before CameraX bind.
- **Bind retries** — waits for `LifecycleOwner` from React Native.

If preview is still black:

1. Confirm **Flip** app (`social.flip.app`), not Expo Go.
2. Rebuild after native changes: `npm run android:dev`.
3. Logcat: `adb logcat -s FlipCamerawesome FlipCameraSession` — look for `bindSession: defer until layout` or `CameraX bind failed`.
4. Force-stop and relaunch: `flip-reset-dev.bat`.

### Dev server / Metro won't connect

1. Run `.\flip-check-env.bat` — confirms device, Metro 8081, LAN IP.
2. Same Wi-Fi on phone and PC; disable VPN/guest network.
3. `flip-reset-dev.bat` — kills stale Metro, fresh cache, LAN deep link.
4. Windows firewall: allow inbound TCP **8081** on Private network (see DEV_BUILD_ANDROID.md).
5. Last resort: `npm run start:tunnel` (slow).

### Create tab placeholder

- Wrong app — open **Flip** home screen icon, not Expo Go.
- Stale binary — `npm run android:dev`.
- Check autolinking: `npx expo-modules-autolinking resolve --platform android` lists `flip-camerawesome`.

### Ghost audio (feed keeps playing)

Feed playback is stopped when switching tabs/segments (`feedPlaybackGuard.ts`). If audio persists:

1. Reload JS: `flip-reload.bat`.
2. Force-stop app: `adb shell am force-stop social.flip.app` then `flip-connect.bat`.
3. If after native navigation changes, rebuild may be needed.

### `adb devices` empty / unauthorized

See [DEV_BUILD_ANDROID.md — Part 4](./DEV_BUILD_ANDROID.md#part-4--connect-the-phone). Samsung USB driver, data cable, revoke USB authorizations and replug.

---

## Environment check script

```powershell
.\scripts\check-android-dev-env.ps1
# or
.\flip-check-env.bat
```

Checks: Node, adb, `ANDROID_HOME`, JDK, S26 Ultra connected, Metro on 8081. Prints pass/fail and suggested next command.

---

## Android Studio (optional)

For Kotlin / Logcat only — not required for daily JS dev.

```powershell
.\scripts\install-android-studio-plugins.ps1   # optional ADB Idea (close AS first)
```

See [ANDROID_STUDIO_PLUGINS.md](./ANDROID_STUDIO_PLUGINS.md).
