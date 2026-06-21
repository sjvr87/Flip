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
npx expo start
```

Sign in with your Bluesky handle and an app password (not your account password).

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
| Resolution | 1080p (FHD, 1920×1080) |
| Target FPS | 60 (hardware fallback if unsupported) |
| Stabilization | Video stabilization + OIS via Camera2 interop |
| Exposure | Auto-exposure tuned for flagship sensors (Samsung Ultra class) |
| Bitrate | 12 Mbps |

**Requires a dev client rebuild** (not Expo Go):

```bash
cd flip-app
npm install
npx expo prebuild --platform android
npx expo run:android
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
