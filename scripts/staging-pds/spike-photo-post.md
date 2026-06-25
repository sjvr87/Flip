# Phase 0 — manual sign-in + photo post checklist

Use this checklist after creating a test account with `create-test-account.*`.

## Prerequisites

- [ ] Staging PDS running (see `README.md`)
- [ ] Test account created (`alice.staging.flip.app` or local equivalent)
- [ ] Flip dev build installed on device / emulator
- [ ] `adb reverse tcp:8081 tcp:8081` active (Metro)

---

## Step 1 — Sign in

1. Open Flip dev build.
2. On the sign-in screen tap **Use app password instead**.
3. Enter:
   - **Handle:** `alice.staging.flip.app` (or `alice.127.0.0.1:2583` for local)
   - **Password:** the password you set in `create-test-account.*`
   - **Server (optional):** `staging.flip.app` (pre-filled in `__DEV__` if env var set)
4. Tap **Sign in**.
5. ✅ Verify: home feed loads (may be empty — that's expected).

---

## Step 2 — Post a photo

1. Tap the camera / compose button.
2. Select a photo from the gallery (no video — deferred to Phase 1).
3. Add optional caption and tap **Post**.
4. ✅ Verify in logcat: `uploadBlob` request hits staging PDS, **not** `video.bsky.app`.
5. ✅ Verify: post appears on the profile tab.

**Expected logcat pattern:**
```
[upload] blob uploaded to https://staging.flip.app/xrpc/com.atproto.repo.uploadBlob
```

**Failure signal (should NOT appear):**
```
video.bsky.app
```

---

## Step 3 — Inspect the repo

```bash
curl -s "https://staging.flip.app/xrpc/com.atproto.repo.listRecords?\
  repo=<alice-did>&collection=app.bsky.feed.post" | jq .
```

Confirm the `app.bsky.feed.post` record includes the blob ref.

---

## Step 4 — Relay-only follow (optional)

See `README.md` Step 5 for the follow record creation.  
Confirm the follow record appears in Bob's followers list via the staging PDS repo API.

---

## Acceptance criteria

| Check | Result |
|-------|--------|
| Sign-in with staging handle succeeds | ☐ |
| Photo upload hits staging PDS, not video.bsky.app | ☐ |
| `app.bsky.feed.post` record visible in PDS repo | ☐ |
| No `ReactNativeJS:E` errors in logcat | ☐ |
