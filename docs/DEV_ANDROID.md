# Android development (Flip dev build)

> **Flip does not use Expo Go.** Use the **Flip** app (`social.flip.app`) installed via `npm run android:build` or `npm run android:dev:setup`.  
> **Start here:** [DEV_BUILD_ANDROID.md](./DEV_BUILD_ANDROID.md)

This document is kept for **network troubleshooting** when Metro cannot be reached. All setup and daily workflow live in **DEV_BUILD_ANDROID.md**.

Flip uses **Expo SDK 56** with **`expo-dev-client`**. Metro runs with `--dev-client` so QR codes and deep links target `flip://expo-development-client/?url=...`, not `exp://` (Expo Go).

## What works where

| Feature | Expo Go (not supported) | Flip dev build (`npm run android:build`) |
|---------|-------------------------|----------------------------------------|
| Feed, sign-in, profile, explore | — | Yes |
| Android camera (CameraX) | — | Yes |

The Create tab needs the **Flip dev build** because it uses the local `flip-camerawesome` native module. See [CAMERA.md](./CAMERA.md).

---

## Legacy: Expo Go network notes

The sections below describe Metro connectivity tests. They apply equally to the **Flip dev build** — substitute “open Flip app” wherever older text says “scan QR in Expo Go”.

### Step 1: Network test (rules out “failed to download remote update”)

This error means the phone **never reached Metro** on your PC. It is **not** a Flip code bug.

1. On your PC, run (PowerShell, project root):

   ```powershell
   cd C:\Users\tomas\Documents\Flip
   npm run start:lan
   ```

2. On the PC, run `ipconfig` and note your **Wi‑Fi IPv4** (e.g. `192.168.1.42`).

3. On the **S26 Ultra**, open **Chrome** and go to:

   ```
   http://YOUR_PC_IP:8081
   ```

   Example: `http://192.168.1.42:8081`

| What you see in Chrome | Meaning |
|------------------------|---------|
| Metro / React Native packager page | Network OK — scan QR in Expo Go |
| “Can’t reach this page” / timeout | **Network/firewall** — go to Step 2, skip code debugging |
| Page loads but Expo Go still fails | Try **tunnel** (Step 2) or check VPN/guest Wi‑Fi |

4. PC and phone must be on the **same Wi‑Fi** (not guest network). Turn off **VPN** on both.

### Step 2: Tunnel mode (most reliable on Windows + Samsung)

If Step 1 failed or Expo Go still shows “failed to download remote update”:

```powershell
cd C:\Users\tomas\Documents\Flip
npm run start:tunnel
```

Scan the **new** tunnel QR code. Tunnel is slower but bypasses LAN/firewall issues.

### Step 3: Windows Firewall

When Windows prompts for **Node.js** / **Metro**, allow **Private networks**.

Or add a rule (PowerShell **as Administrator**):

```powershell
New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
```

### Step 4: Force PC LAN IP in QR code

If the QR code shows a wrong address:

```powershell
cd C:\Users\tomas\Documents\Flip
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.42"   # your IPv4 from ipconfig
npm run start:clear
```

### Step 5: Extra debug logging on PC

```powershell
cd C:\Users\tomas\Documents\Flip
$env:EXPO_DEBUG = "1"
npm run start:clear
```

Watch the terminal when you scan the QR code.

---

## Diagnose what the phone is doing

| Symptom | Cause | What to do |
|---------|-------|------------|
| Red/white error: **failed to download remote update** | Metro unreachable | Steps 1–4 above; use **tunnel** |
| **Nothing** in Metro terminal after scan | Same — no connection | Tunnel + firewall |
| Metro logs `Android Bundled …` but phone stuck on splash | JS startup hang | Shake phone → Reload; see “Stuck on splash” below |
| Blue banner **“Flip · Expo Go · SDK 56”** then sign-in | **Success** — JS loaded | Log in and use the app |
| Red screen **“Flip failed to start”** with stack trace | JS crash on startup | Copy the error text; share for debugging |
| Expo Go closes with no message | Native crash | Uncommon in Expo Go; try Clear data + tunnel |

When you scan the QR code, Metro should log something like:

```
Android Bundled 1234ms node_modules\expo-router\entry.js (…)
```

If **nothing** appears, the phone still cannot reach your PC.

---

## `failed to download remote update` in Expo Go

This fatal error is **not** caused by a misconfigured `expo-updates` URL in this project (Flip does not use `expo-updates` or EAS Update). Expo Go uses its built-in loader to fetch the **Metro JS bundle** from your PC.

Typical causes on **Windows PC + Samsung phone**:

1. PC and phone on different networks (guest Wi‑Fi, mobile hotspot isolation, VPN).
2. Windows Firewall blocking inbound Node/Metro on port **8081**.
3. Stale project URL or cache in Expo Go.
4. QR code shows an unreachable address (IPv6 / wrong LAN IP).

### Fix steps (try in order)

#### 1. Clear caches and restart Metro

```powershell
cd C:\Users\tomas\Documents\Flip
npm run start:clear
```

#### 2. Use tunnel mode (most reliable on Windows)

```powershell
npm run start:tunnel
```

Scan the **new** QR code in Expo Go.

#### 3. Same Wi‑Fi + LAN mode

- Connect **PC and S26 Ultra to the same Wi‑Fi** (not guest network).
- Turn off VPN on PC and phone.
- Start with explicit LAN:

```powershell
npm run start:lan
```

#### 4. Allow Metro through Windows Firewall

See Step 3 in the S26 section above.

#### 5. Clear Expo Go cache on the phone

On **Samsung Galaxy S26 Ultra**:

1. **Settings → Apps → Expo Go**
2. **Storage → Clear cache** (or **Clear data** if cache alone fails)
3. Reopen Expo Go and scan the QR code again

---

## Stuck on splash / startup crashes

These are **JavaScript startup** issues (Metro *did* deliver the bundle). Fixes in this repo:

- **`StartupErrorBoundary`** at the root — if JS crashes during render, you see a red **“Flip failed to start”** screen with the error instead of a blank app.
- **Expo Go minimal layout** — no `Stack.Protected`, no hydration overlay; splash hides immediately and sign-in shows with zero gates.
- **`ThemeProvider` always wraps the navigation tree** — tabs never mount outside the provider.
- **Native modules** (`react-native-mmkv`, `react-native-keyboard-controller`, `flip-camerawesome`) are gated via `useSafeNativeShims` in `src/utils/runtime.ts` so Expo Go does not load them at import time.
- **`expo-notifications`** setup is skipped entirely in Expo Go at startup.

If you see a red error screen, shake the device → **Reload**, or run `npm run start:clear` on the PC.

---

## Verify the Android bundle builds

From the project root (no device required):

```powershell
cd C:\Users\tomas\Documents\Flip
npx expo export --platform android
```

This should finish without errors and write output under `dist/`. A successful export means the JS bundle compiles; if Expo Go still fails, the problem is almost always **network** or **Expo Go cache**, not TypeScript/build errors.

---

## Full Android dev build (camera + native modules)

Expo Go cannot run the Create tab camera. Use a **dev build** — the **Flip** app icon on your phone, **not** Expo Go.

**Complete walkthrough (Samsung S26 Ultra + Windows):** **[DEV_BUILD_ANDROID.md](./DEV_BUILD_ANDROID.md)** — USB debugging, Android Studio, PowerShell commands, first build (~10–20 min), Metro workflow, troubleshooting, EAS fallback.

Quick start:

```powershell
cd C:\Users\tomas\Documents\Flip
npm install
npm run android:dev:setup
```

Then `npm start` in a second terminal and open **Flip** on the phone.

**CameraX 1080p60 recording requires a dev build.** Expo Go will only show a placeholder on the Create tab.

---

## Samsung Gallery & photo permissions (S26 Ultra)

Flip uses two separate gallery paths on Android:

| Action | What opens | Permission needed? |
|--------|------------|-------------------|
| **Upload** (Create tab) | **Samsung Gallery** directly via native intent (`setPackage`) | **No** — the picker returns a content URI with a temporary read grant |
| **Recent thumbnail** (upload tile preview) | Reads MediaStore via `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` | **Yes** — standard Android permission dialog |

### If permission dialog only shows Google Photos

On Android 14+ (One UI 7), choosing **“Select photos and videos”** opens the system **Photo Picker**, which on many Samsung phones defaults to **Google Photos**. That is an OS limitation for *limited* access — not the Upload picker.

**Recommended settings:**

1. **Settings → Apps → Flip → Permissions → Photos and videos**
2. Choose **Allow all** (full MediaStore access) — best for the recent-thumbnail preview and browsing your on-device library.
3. Avoid **Select photos and videos** unless you only want a few items visible to Flip.

If the limited picker only lists Google Photos and you need Samsung Gallery items:

1. Set Flip to **Allow all** (step 2 above), **or**
2. Use **Upload** — it opens Samsung Gallery directly and does not use the Photo Picker permission flow.

### Rebuild after native gallery changes

Native gallery code lives in `modules/flip-camerawesome`. After pulling changes, rebuild the dev app:

```powershell
cd C:\Users\tomas\Documents\Flip
npm.cmd run android:build
```

Verify Samsung Gallery opens:

```powershell
adb logcat -s FlipGalleryPicker
```

You should see `Resolved Samsung handler` or `Using direct package intent` when tapping Upload.

---

## Configuration notes

- `app.json` sets `"updates": { "enabled": false }` — no OTA updates configured.
- There is **no** `updates.url` or `runtimeVersion` — Expo Go dev loads from Metro only.
- `extra.eas.projectId` is empty; EAS Update is not configured.
- `metro.config.js` uses the default Expo config (no custom blockers).
- SDK versions: `expo ~56.0.5`, `react-native 0.85.3`, `expo-router ~56.2.7` — matches current Expo Go for SDK 56.

## Quick reference scripts

| Command | Purpose |
|---------|---------|
| `npm run start:clear` | Clear Metro cache, start dev server |
| `npm run start:lan` | Force LAN URL in QR code |
| `npm run start:tunnel` | Route through Expo tunnel (best for Windows + phone) |
| `npm run android:build` | Gradle debug APK + `adb install` (native rebuild) |
| `npm run android:gradle` | Alias for `android:build` |
| `npm run android:dev` | Alias for `android:build` |
| `npm run android:dev:setup` | Prebuild + `android:build` (first-time setup) |
