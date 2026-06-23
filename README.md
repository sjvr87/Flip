# Flip

Bluesky-native short video app built on the **loops-expo UI** with an **@atproto/api** data layer.

## What works (MVP)

- Bluesky login with handle + [app password](https://bsky.app/settings/app-passwords)
- Vertical video feed (loops-expo UI)
- **Following** tab — timeline filtered to video posts
- **Discover / For You** — global video search (or custom feed generator if configured)
- Like / unlike posts
- Profile tab — your video grid via `posts_with_video` author feed

## Project layout

```
flip-app/
├── src/atproto/          ← Bluesky data layer (new)
│   ├── agent.ts          Session + BskyAgent
│   ├── adapters.ts       ATProto post → FlipVideo
│   ├── auth.ts           Login, profile, config
│   ├── feeds.ts          Timeline + discover feeds
│   └── social.ts         Like, bookmark
├── src/components/       ← loops-expo UI (unchanged)
└── src/app/              ← loops-expo screens (auth + feed wired to ATProto)
```

## Setup

```bash
cd flip-app
npm install
npm.cmd start
```

Sign in with your Bluesky handle and an app password (not your account password).

### Android development (Flip dev build)

Flip uses a **development build** (`social.flip.app`) — **not Expo Go**. Camera and native modules require the Flip app icon on your home screen.

1. First-time setup: `npm run android:dev:setup` (prebuild + Gradle build + install).
2. Daily dev: `npm.cmd start` on PC, `adb reverse tcp:8081 tcp:8081`, open **Flip** on the phone.
3. Native rebuild only: `npm run android:build` (Gradle + adb — not needed for JS-only edits).

Full guide: **[docs/DEV_BUILD_ANDROID.md](docs/DEV_BUILD_ANDROID.md)**. S26 Ultra quick ref: **[docs/ANDROID_FLAGSHIP_DEV.md](docs/ANDROID_FLAGSHIP_DEV.md)** (`flip-check-env.bat` to verify setup).

Metro should say **"Using development build"** (not Expo Go). Deep links use `flip://expo-development-client/?url=...`.

## Optional: custom For You feed

Set a feed generator AT-URI in `app.json`:

```json
"extra": {
  "flipForYouFeed": "at://did:plc:xxx/app.bsky.feed.generator/your-feed"
}
```

Or via env: `EXPO_PUBLIC_FLIP_FORYOU_FEED`.

## Camera (Android)

The Create tab on **Android** uses **`flip-camerawesome`**, a local Expo module built on **Google CameraX**:

| Setting | Value |
|---------|--------|
| Resolution | 1080p (FHD, 1920×1080) — **no 4K path** |
| Target FPS | 60 (hardware fallback if unsupported) |
| Codec | H.264 (AVC); HEVC not configured |
| Stabilization | Video stabilization + OIS via Camera2 interop |
| Exposure | Auto-exposure tuned for flagship sensors (Samsung Ultra class) |
| Bitrate | 12 Mbps |
| Upload | Re-compressed via `react-native-compressor` before Loops upload |

Full quality audit, S26 Ultra gaps, and future targets: **[docs/CAMERA.md](docs/CAMERA.md)**.

**Requires a dev build** — the Flip app (`social.flip.app`), not Expo Go. Full Windows + Samsung guide: **[docs/DEV_BUILD_ANDROID.md](docs/DEV_BUILD_ANDROID.md)**. Flagship device notes: **[docs/ANDROID_FLAGSHIP_DEV.md](docs/ANDROID_FLAGSHIP_DEV.md)**.

```bash
cd flip-app
npm install
npm run android:dev:setup   # first time only (prebuild + build)
npm.cmd start               # daily; adb reverse tcp:8081 tcp:8081; open Flip app
npm run android:build       # native changes only (Gradle + adb install)
```

iOS continues to use `react-native-vision-camera` via `create.ios.tsx`.

## Not yet wired to ATProto

These screens still call the original Loops REST API and need follow-up work:

- Camera / video upload (`video.bsky.app` pipeline)
- Comments modal
- Notifications
- Explore hashtags
- Settings (password, privacy)
- Playlists, duets, studio

## Custom PDS

On the sign-in screen, change **Server** from `bsky.social` to your PDS host if needed.

## License

UI derived from [loops-expo](https://github.com/joinloops/loops-expo) (AGPL). ATProto layer is part of this project.
