# AGENTS.md

## Cursor Cloud specific instructions

Flip is a **native (Android/iOS) Expo / React Native app** (Bluesky-native short-video app, `@atproto/api` data layer). There is no in-repo backend; all data comes from external Bluesky/ATProto infrastructure (`bsky.social`, `api.bsky.app`, `video.bsky.app`). Standard commands live in `package.json` `scripts` and `README.md` — reference those rather than duplicating.

### Environment facts (non-obvious)
- **Not web-compatible.** `index.js` imports `react-native/Libraries/Core/InitializeCore`, so `npm run web` / `expo export --platform web` fail to bundle (`Importing react-native internals is not supported on web`, HTTP 500). Do **not** use the web target to test app behavior.
- **No Android emulator on the cloud VM.** No `/dev/kvm`, no nested virtualization, and no Android SDK are present, so a hardware-accelerated emulator is not possible. On-device/emulator UI testing requires hardware not available here.
- **Windows scripts don't run here.** The root `flip-*.bat` and `scripts/*.ps1` / `*.cmd` helpers are Windows-only; on this Linux VM call the underlying `npm`/`expo` commands directly (e.g. `npx expo start --port 8081`).

### How to run / verify the dev environment (Linux VM)
- **Metro dev server (daily dev):** `npm start` (= `expo start --dev-client --lan --port 8081`). This is the real artifact served to a device.
- **Verify the app builds** without a device by compiling the JS bundles Metro serves:
  - `curl "http://localhost:8081/index.bundle?platform=android&dev=true"` → HTTP 200 (~1670 modules)
  - `curl "http://localhost:8081/index.bundle?platform=ios&dev=true"` → HTTP 200 (~1225 modules)
- **Lint:** `npm run lint` (`expo lint`). **Typecheck:** `npx tsc --noEmit`. Both currently report many **pre-existing** errors/warnings in the repo source — these are not environment problems; do not treat them as setup failures.

### Auth / live data
- Login needs a **real Bluesky account** (handle + [app password](https://bsky.app/settings/app-passwords)); there are no committed credentials.
- Unauthenticated reads that DO work against the public AppView (`https://public.api.bsky.app`): `com.atproto.identity.resolveHandle`, `app.bsky.actor.getProfile`, and `app.bsky.feed.getAuthorFeed?filter=posts_with_video` (the call the Profile grid / For-You suggestions use — useful for smoke-testing the content pipeline without login).
- Authenticated-only (return 403/502 without a session): `searchPosts`, `getTimeline`, and feed generators like `thevids` / `whats-hot`. The Discover/For-You/Following tabs therefore need a logged-in session to populate.

### Install note
`npm install` runs a `postinstall` that patches the `android/` dir (`scripts/patch-*.js`); this is safe to run before `expo prebuild` (it no-ops when `android/` is absent).
