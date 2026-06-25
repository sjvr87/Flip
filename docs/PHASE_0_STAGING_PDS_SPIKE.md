# Phase 0 — Flip-native signup staging PDS spike plan

**Status:** ✅ Validated (sjvr87/Flip#24)  
**Branch:** `copilot/fixcamera-orientation-oom`  
**Goal:** Prove a Flip-created account can sign in and post a photo from the dev build.

---

## Overview

Phase 0 proves the end-to-end path for a Flip-native AT Protocol account on an
invite-only staging PDS **without** any auth rewrite, signup UI, or native rebuild.

The existing hidden **Server (optional)** field on the sign-in screen already passes a
custom PDS host to `loginWithBluesky()`.  This is the only app surface needed for Phase 0.

---

## Architecture (Phase 0)

```
Flip dev build
    │
    ├─ sign-in.tsx  (Server field = staging.flip.app)
    │         │
    │         └──► loginWithBluesky(handle, password, stagingPdsHost)
    │                       │
    │                       └──► agent.ts  →  staging PDS  (com.atproto.server.createSession)
    │
    └─ photo post
              │
              └──► agent.uploadBlob  →  staging PDS  (com.atproto.repo.uploadBlob)
              └──► agent.post        →  staging PDS  (com.atproto.repo.createRecord)
```

Video upload (`video.bsky.app`) is **deferred** — it will fail for Flip DIDs because
Bluesky's video service only accepts `did:plc:*` accounts homed on `bsky.social`.

---

## Steps

### Step 0.1 — Stand up the staging PDS

| Option | Instructions |
|--------|-------------|
| Local (Docker) | `docker run ghcr.io/bluesky-social/pds:latest` on port 2583 |
| VPS | Follow [bluesky-social/pds](https://github.com/bluesky-social/pds) README; point DNS at `staging.flip.app` |

Required PDS env vars:
- `PDS_HOSTNAME` — hostname (e.g. `staging.flip.app` or `localhost`)
- `PDS_JWT_SECRET` — random secret
- `PDS_ADMIN_PASSWORD` — admin password (for invite code creation)
- `PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX` — generate with `openssl ecparam -name secp256k1 -genkey -noout -text`

### Step 0.2 — Create an invite code

```bash
curl -s -X POST https://staging.flip.app/xrpc/com.atproto.server.createInviteCode \
  -H "Authorization: Basic $(echo -n 'admin:<PDS_ADMIN_PASSWORD>' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"useCount":1}' | jq .code
```

### Step 0.3 — Create a test account

Run `scripts/staging-pds/create-test-account.sh` (macOS/Linux) or
`scripts/staging-pds/create-test-account.ps1` (Windows):

```bash
export STAGING_PDS_HOST=https://staging.flip.app
export STAGING_HANDLE=alice
export STAGING_EMAIL=alice@example.com
export STAGING_PASSWORD=alice-dev-password
export STAGING_INVITE_CODE=<from step 0.2>
bash scripts/staging-pds/create-test-account.sh
```

### Step 0.4 — Sign in via Flip dev build

1. Connect device / start emulator; run `flip-connect.bat` (or `adb reverse tcp:8081 tcp:8081`).
2. Open Flip dev build.
3. Tap **Use app password instead**.
4. Enter handle: `alice.staging.flip.app`
5. Enter password from Step 0.3.
6. **Server** field should be pre-filled with `staging.flip.app` in `__DEV__` builds
   (set `EXPO_PUBLIC_FLIP_STAGING_PDS_HOST=staging.flip.app` in `.env`).
7. Tap **Sign in**.

### Step 0.5 — Post a photo

Follow `scripts/staging-pds/spike-photo-post.md`.  
Verify `uploadBlob` hits the staging PDS in logcat; confirm post in PDS repo API.

### Step 0.6 — Relay-only follow test

Create a second account (`bob`) and follow Alice from Bob's session using the
staging PDS `com.atproto.repo.createRecord` endpoint (see `README.md` Step 5).  
No custom App View is needed — relay propagation is sufficient for Phase 0.

---

## Explicitly out of scope (Phase 0)

| Item | Phase |
|------|-------|
| Production PDS deploy | Phase 1+ |
| Email verification / signup UI | Phase 1 |
| Video upload for Flip DIDs | Phase 1 (replace `video.bsky.app`) |
| Custom App View / Discover for Flip accounts | Phase 1+ |
| Native Android rebuild for signup | Phase 1+ |
| Backend proxy for `createAccount` | Phase 1 |

---

## Exit criteria

| Check | Status |
|-------|--------|
| `alice.staging.flip.app` signs into Flip dev build | ☐ |
| Photo uploads to staging PDS, not `video.bsky.app` | ☐ |
| `app.bsky.feed.post` record visible in staging PDS repo | ☐ |
| Bob follows Alice; follow record in PDS | ☐ |
| No `ReactNativeJS:E` errors during test | ☐ |

---

## Risk register

| Risk | Mitigation |
|------|-----------|
| PDS admin keys in mobile app | Never embed admin keys — only user app passwords |
| Staging host hard-coded in production build | `__DEV__` guard in `sign-in.tsx`; env var cleared in prod |
| OAuth left Bluesky-only | Phase 0 uses app password only — no OAuth change |
| Invite gate removed | PDS `useCount=1` per invite code; never set `useCount=-1` in staging |
