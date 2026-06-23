# Android Studio setup (Flip)

What Flip needs in Android Studio for Expo RN + Kotlin native (`flip-camerawesome`). Heavy or unrelated marketplace plugins are intentionally omitted.

S26 Ultra daily workflow and `flip-*.bat` scripts: **[ANDROID_FLAGSHIP_DEV.md](./ANDROID_FLAGSHIP_DEV.md)**.

## Daily dev vs Android Studio

| Task | Tool |
|------|------|
| JS/TS edits, Metro, adb connect | **Cursor** + `flip-dev.bat` / `flip-connect.bat` / `flip-reload.bat` |
| Kotlin native code, Gradle sync, logcat | **Android Studio** |
| Camera / native module rebuild | `npm run android:dev` (see [DEV_BUILD_ANDROID.md](./DEV_BUILD_ANDROID.md)) |

You do not need Android Studio open for everyday Flip development. Use it when editing `modules/flip-camerawesome`, debugging native crashes, or inspecting Logcat.

---

## Built-in plugins (no install)

Shipped with Android Studio - do **not** reinstall from Marketplace:

| Plugin | Plugin ID |
|--------|-----------|
| Kotlin | `org.jetbrains.kotlin` |
| Gradle | `org.jetbrains.plugins.gradle` |
| Android | `org.jetbrains.android` |

---

## SDK packages (one-time)

Install SDK components via **Android Studio - SDK Manager** before your first native build. Full list and license steps:

**[DEV_BUILD_ANDROID.md - Part 2 (Install Android Studio and SDK)](./DEV_BUILD_ANDROID.md#part-2--install-android-studio--sdk-one-time)**

Summary:

- **SDK Platforms:** Android 15 (API 35) or latest required by Expo SDK 56
- **SDK Tools:** Build-Tools, Platform-Tools, Command-line Tools, NDK, CMake, Google USB Driver

---

## Optional: ADB Idea

Run common `adb` actions (uninstall app, clear data, restart activity) from the IDE. Handy when iterating on the Flip dev build and `flip-camerawesome`.

| | |
|--|--|
| **Name** | ADB Idea |
| **Plugin ID** | `com.developerphil.adbidea` |
| **Marketplace** | [ADB Idea](https://plugins.jetbrains.com/plugin/7380-adb-idea) |

### Install via script (preferred)

Close Android Studio, then from the Flip repo root:

```powershell
.\scripts\install-android-studio-plugins.ps1
```

The script finds `studio64.exe`, skips bundled plugins, and runs:

```text
studio64.exe installPlugins com.developerphil.adbidea
```

### Manual install in IDE

1. **File - Settings** (Windows) or **Android Studio - Settings** (macOS)
2. **Plugins - Marketplace**
3. Search **ADB Idea** - **Install** - restart when prompted

### Manual CLI

Close Android Studio first (only one instance allowed):

```powershell
& "C:\Program Files\Android\Android Studio\bin\studio64.exe" installPlugins com.developerphil.adbidea
```

### Verify

**Settings - Plugins - Installed** - confirm **ADB Idea** is enabled. Use **Tools** menu entries or context menus for adb shortcuts.

---

## Native camera rebuild

After changing Kotlin under `modules/flip-camerawesome` or native config in `app.json`:

```powershell
npm run android:dev
```

Then reconnect with `flip-connect.bat` or `flip-dev.bat`. See [DEV_BUILD_ANDROID.md](./DEV_BUILD_ANDROID.md) for first-time setup (`android:dev:setup`) and troubleshooting.
