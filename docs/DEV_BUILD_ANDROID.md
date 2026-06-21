# Android dev build on Windows (Samsung Galaxy S26 Ultra)

This guide gets **Flip** installed on your phone as its **own app** — the Flip icon on your home screen. Flip uses **`expo-dev-client`**; Metro targets the dev build via `flip://expo-development-client/?url=...`. **Do not use Expo Go** for this project.

Only a dev build includes the native **CameraX** camera (`flip-camerawesome`).

**Project path:** `C:\Users\tomas\Documents\Flip`  
**Stack:** Expo SDK 56 · React Native 0.85 · local module `modules/flip-camerawesome`

---

## What you are building

| App on phone | Camera (Create tab) | How JS loads |
|--------------|---------------------|--------------|
| **Flip (dev build)** | Real CameraX 1080p60 | Metro when dev server is running (`flip://` deep link) |

After the first install you will:

1. Run `npm.cmd start` on your PC (Metro — should say **Using development build**).
2. Run `adb reverse tcp:8081 tcp:8081` (USB) or use same Wi‑Fi.
3. Open the **Flip** app on the phone (home screen icon, `social.flip.app`).

You only re-run `npx expo run:android` when native code or `app.json` plugins change — not for everyday JS edits.

---

## Prerequisites checklist

Before you start, you need:

- [ ] **Node.js 20+** (you have v26 — good). Check: `node --version`
- [ ] **Android Studio** (Ladybug or newer) with Android SDK
- [ ] **JDK 17 or 21** (Android Studio bundles JDK 21 — use that)
- [ ] **USB cable** (data-capable, not charge-only)
- [ ] Samsung **Developer options** + **USB debugging** enabled
- [ ] Phone and PC on the **same Wi‑Fi** (for Metro after install; USB alone is enough for the first build)

Verified on this machine:

- Android SDK: `%LOCALAPPDATA%\Android\Sdk`
- `adb`: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`
- `npx expo prebuild --platform android` completes successfully
- `flip-camerawesome` autolinks into the Android project

The `android/` folder is **generated** by prebuild and is gitignored — you create it locally, not from git.

---

## Part 1 — Enable Developer Options (Samsung S26 Ultra)

1. Open **Settings → About phone → Software information**.
2. Tap **Build number** **7 times** until you see “Developer mode has been enabled”.
3. Go back → **Developer options** (often under **Settings → Developer options**, or search “Developer”).
4. Turn on:
   - **USB debugging**
   - **Install via USB** (if present — helps sideloading debug APKs)
5. Optional but useful: **Stay awake** (screen on while charging) while debugging.

When you first plug in USB, the phone shows **Allow USB debugging?** — tap **Allow** and optionally **Always allow from this computer**.

---

## Part 2 — Install Android Studio & SDK (one-time)

### 2.1 Download and install

1. Download [Android Studio](https://developer.android.com/studio).
2. Run the installer. Include:
   - **Android SDK**
   - **Android SDK Platform**
   - **Android Virtual Device** (optional; you will use a real phone)

### 2.2 SDK components (Android Studio → SDK Manager)

Open **Android Studio → More Actions → SDK Manager** (or **Settings → Languages & Frameworks → Android SDK**).

**SDK Platforms** tab — install:

- **Android 15 (API 35)** — or the latest shown as installed for Expo SDK 56

**SDK Tools** tab — install:

- Android SDK Build-Tools (latest)
- Android SDK Platform-Tools
- Android SDK Command-line Tools
- NDK (Side by side) — required by some native deps (Skia, Reanimated, Vision Camera)
- CMake

Click **Apply** and wait for downloads to finish.

### 2.3 Accept licenses

Open **PowerShell** and run (adjust path if your SDK lives elsewhere):

```powershell
cd $env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin
.\sdkmanager.bat --licenses
```

Type `y` for each prompt.

If `latest` does not exist, use the versioned folder under `cmdline-tools\` (e.g. `11.0\bin`).

---

## Part 3 — Environment variables (one-time, Windows)

Set these so Gradle and `adb` work from any terminal.

**GUI:** Start → “environment variables” → **Edit the system environment variables** → **Environment Variables**.

| Variable | Value (typical) |
|----------|-----------------|
| `ANDROID_HOME` | `C:\Users\tomas\AppData\Local\Android\Sdk` |
| `JAVA_HOME` | `C:\Program Files\Android\Android Studio\jbr` |

Add to **Path** (User or System):

```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%ANDROID_HOME%\cmdline-tools\latest\bin
%JAVA_HOME%\bin
```

**Close and reopen PowerShell** after changing Path.

Quick test:

```powershell
adb version
java -version
node --version
```

All three should print versions without “not recognized”.

### PowerShell session only (if you skip permanent env vars)

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin;C:\Program Files\nodejs;$env:Path"
```

---

## Part 4 — Connect the phone

### Option A — USB (recommended for first build)

1. Plug the phone into the PC with a **data** USB cable.
2. On the phone, pull down the notification shade → USB → choose **File transfer / Transferring files** (not “Charge only”).
3. Confirm the **USB debugging** RSA fingerprint dialog → **Allow**.

```powershell
adb devices
```

Expected:

```
List of devices attached
R5XXXXXXXX    device
```

If you see `unauthorized`, unlock the phone and accept the debugging prompt. If `offline`, unplug, run `adb kill-server`, plug back in.

**Samsung USB drivers:** Windows usually installs them automatically. If `adb devices` is empty with no prompt on the phone, install [Samsung USB Driver](https://developer.samsung.com/android-usb-driver) or let Android Studio install the Google USB driver (**SDK Manager → SDK Tools → Google USB Driver**).

### Option B — Wireless debugging (after USB works once)

On the phone: **Developer options → Wireless debugging → On**.

1. Tap **Pair device with pairing code** — note **IP:port** and **pairing code**.
2. On PC:

```powershell
adb pair 192.168.1.XX:XXXXX
# Enter pairing code when prompted
adb connect 192.168.1.XX:YYYYY
adb devices
```

Use the **connect** port from the Wireless debugging screen (not always the same as the pair port).

Wireless is handy day-to-day; use USB if pairing fails or the PC firewall blocks Wi‑Fi adb.

---

## Part 5 — Build and install Flip (first time)

Open **PowerShell**. Run these **in order**.

### Step 1 — Project folder and dependencies

```powershell
cd C:\Users\tomas\Documents\Flip
npm install
```

This installs **`expo-dev-client`** (required). Metro will target the Flip dev build, not Expo Go.

### Step 2 — Generate the native Android project

```powershell
npx expo prebuild --platform android
```

This creates the `android\` folder from `app.json` and links native modules (including `expo-dev-client`, `flip-camerawesome`, Vision Camera, Reanimated, Skia).

To regenerate from scratch later:

```powershell
npx expo prebuild --platform android --clean
```

### Step 3 — Build, install, and launch on the phone

With the phone connected (`adb devices` shows `device`):

```powershell
npx expo run:android
```

Or use the npm shortcut:

```powershell
npm run android:dev
```

### What to expect (first build)

- **Duration:** roughly **10–20 minutes** (sometimes longer on first run).
- Gradle downloads dependencies (~hundreds of MB).
- NDK / CMake may compile native code (Skia, Reanimated, CameraX, etc.).
- The Flip **debug APK** installs on the phone and should open automatically.
- You should see the **Flip** app icon — same branding as production, not the Expo Go icon.

If the build succeeds but the app does not open, find **Flip** in the app drawer and tap it.

---

## Part 6 — Daily development workflow

You need **two terminals** (or one build + one server).

**Terminal 1 — Metro (keep running):**

```powershell
cd C:\Users\tomas\Documents\Flip
npm.cmd start
```

Metro should print **Using development build** (not Expo Go). The QR code deep link uses `flip://expo-development-client/?url=...`. Scanning with the phone camera should offer to open **Flip**, not Expo Go.

**USB (recommended on Samsung):**

```powershell
adb reverse tcp:8081 tcp:8081
```

For stubborn network issues (less common with dev build + USB):

```powershell
npm run start:clear
# or
npm run start:tunnel
```

**Terminal 2 — only when changing native code:**

```powershell
npm run android:dev
```

**On the phone:**

1. Open **Flip** (not Expo Go).
2. Shake the device or press **Ctrl+M** (if using emulator) → **Reload** if JS does not update.
3. Go to the **Create** tab — you should get the real camera preview, not “mobile only” placeholder text.

Metro terminal should log something like:

```
Android Bundled ... node_modules\expo-router\entry.js
```

### Windows Firewall

When prompted, allow **Node.js** on **Private** networks for port **8081**. Or (Admin PowerShell):

```powershell
New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
```

---

## npm scripts reference

| Command | Purpose |
|---------|---------|
| `npm run android:prebuild` | Generate / refresh `android/` from Expo config |
| `npm run android:dev` | Build debug APK and install on connected device |
| `npm run android:dev:setup` | Prebuild + run (first-time shortcut) |
| `npm.cmd start` | Start Metro for the Flip dev build (`--dev-client`) |
| `npm run start:clear` | Metro with cache cleared |
| `npm run start:tunnel` | Metro via Expo tunnel (slow; use if LAN fails) |

---

## Troubleshooting

### `adb devices` is empty

- Use a data USB cable; try another USB port (USB 3 directly on PC, not a hub).
- Enable **USB debugging**; revoke USB debugging authorizations in Developer options and replug.
- Set USB mode to **File transfer**.
- `adb kill-server` then `adb start-server` then `adb devices`.
- Install Samsung / Google USB driver (see Part 4).

### `No Android connected device found`

- Run `adb devices` — must show `device`, not `offline` / `unauthorized`.
- Only one device: `npx expo run:android --device` and pick from the list.

### `JAVA_HOME` / Java version errors

- Point `JAVA_HOME` to Android Studio’s JBR: `C:\Program Files\Android\Android Studio\jbr`
- Expo SDK 56 supports **JDK 17–21**. Avoid random older JDK installs on PATH.

### Gradle / build failures

```powershell
cd C:\Users\tomas\Documents\Flip\android
.\gradlew.bat clean
cd ..
npx expo run:android
```

- Ensure **NDK** and **CMake** are installed in SDK Manager.
- Low disk space: Gradle cache can use several GB under `C:\Users\tomas\.gradle`.
- **Out of memory:** close other apps; `android\gradle.properties` already sets `org.gradle.jvmargs=-Xmx2048m`.

### `CXX1101` / NDK `did not have a source.properties file`

The Android NDK install is incomplete or corrupted.

1. Open **Android Studio → SDK Manager → SDK Tools**
2. Check **NDK (Side by side)** → **Show Package Details**
3. Ensure **27.1.12297006** is installed (or uninstall/reinstall broken **27.0.x**)
4. Retry:

```powershell
cd C:\Users\tomas\Documents\Flip
npm run android:dev
```

This project pins NDK **27.1.12297006** in `android/build.gradle`.

### App installs but shows red error / cannot load bundle

- Metro must be running: `npm start` on the PC.
- Phone and PC on same Wi‑Fi, or use USB with `adb reverse`:

```powershell
adb reverse tcp:8081 tcp:8081
```

- Open **Flip**, not Expo Go.
- `npm run start:clear` and reload the app.

### Create tab still shows placeholder

- You opened the wrong app — use **Flip** (`social.flip.app`), not Expo Go.
- `expo-dev-client` was added — rebuild once: `npm run android:dev`.
- Native binary is stale — rebuild: `npm run android:dev`.
- Confirm autolinking: `npx expo-modules-autolinking resolve --platform android` should list `flip-camerawesome`.

### Metro says "Using Expo Go" or "Press s to switch to Expo Go"

- Run `npm install` (installs `expo-dev-client`), then `npm.cmd start`.
- All `npm start` scripts pass `--dev-client`. After install, Metro defaults to dev build mode.
- Rebuild the app after adding `expo-dev-client`: `npm run android:dev`.

### `SDK location not found`

Create `C:\Users\tomas\Documents\Flip\android\local.properties`:

```properties
sdk.dir=C\:\\Users\\tomas\\AppData\\Local\\Android\\Sdk
```

(Use doubled backslashes. Prebuild often creates this automatically.)

### Gradle 9: `IBM_SEMERU` / foojay error

React Native 0.85 pins `foojay-resolver-convention` 0.5.0, which breaks on Gradle 9. This project runs `scripts/patch-foojay-gradle.js` on `npm install` (postinstall) to bump it to 1.0.0 and register JDK 17.

Install **Eclipse Temurin JDK 17** if you do not have it:

```powershell
winget install --id EclipseAdoptium.Temurin.17.JDK
```

### JDK 17 required (not only Android Studio JBR)

RN’s gradle-plugin uses `jvmToolchain(17)`. Android Studio’s bundled JBR is Java 21 and is not enough by itself. Use Temurin 17 at:

`C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot`

The postinstall patch writes this into `android/gradle.properties`.

### NDK missing or corrupt (`source.properties` not found)

If build fails with `[CXX1101] NDK at ... did not have a source.properties file`, the NDK download was interrupted. In **Android Studio → SDK Manager → SDK Tools**, install **NDK (Side by side) 27.1.12297006**, or from a terminal:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" --install "ndk;27.1.12297006"
```

(Install [command-line tools](https://developer.android.com/studio#command-line-tools-only) first if `sdkmanager` is missing.)

### Build succeeded but Expo install step failed

If Gradle prints `BUILD SUCCESSFUL` but `expo run:android` exits with an error, install the APK manually:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
adb reverse tcp:8081 tcp:8081
adb shell am start -n social.flip.app/.MainActivity
```

---

## Fallback — EAS cloud build (no local Gradle)

If local builds fail (Gradle, NDK, drivers), use **EAS Build** on Expo’s servers. You still run Metro locally; the phone runs a custom dev client APK.

1. Install EAS CLI and log in:

```powershell
npm install -g eas-cli
eas login
```

2. Link the project (sets `extra.eas.projectId` in `app.json`):

```powershell
cd C:\Users\tomas\Documents\Flip
eas init
```

3. Build a development APK:

```powershell
eas build --profile development --platform android
```

4. When the build finishes, open the link on your phone and install the APK (allow “Install unknown apps” if prompted).

5. On PC: `npm start` → open **Flip** dev client on the phone.

`eas.json` already defines a `development` profile with `developmentClient: true`.

---

## Related docs

- [DEV_ANDROID.md](./DEV_ANDROID.md) — Expo Go networking fixes (tunnel, firewall)
- [CAMERA.md](./CAMERA.md) — CameraX quality settings and S26 Ultra notes
- [README.md](../README.md) — project overview

---

## Quick copy-paste — full first-time setup

```powershell
# Env (add permanently via System Properties if you prefer)
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin;C:\Program Files\nodejs;$env:Path"

# Phone plugged in, USB debugging allowed
adb devices

cd C:\Users\tomas\Documents\Flip
npm install
npx expo prebuild --platform android
npx expo run:android
```

Then in a **second** PowerShell window:

```powershell
cd C:\Users\tomas\Documents\Flip
npm start
```

Open **Flip** on the S26 Ultra → test **Create** tab camera.
