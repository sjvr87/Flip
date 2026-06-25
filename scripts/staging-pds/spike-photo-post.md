# Phase 0 spike — photo post on staging PDS

Manual test checklist after creating a staging account with `create-test-account.ps1` / `.sh`.

## Preconditions

- [ ] Staging PDS running and reachable from dev device (LAN IP if not emulator)
- [ ] Test account created (`alice.staging…` + password)
- [ ] Flip dev build with `flipStagingPdsHost` or `EXPO_PUBLIC_FLIP_STAGING_PDS_HOST` set
- [ ] Metro running (`http://127.0.0.1:8081/status` → `packager-status:running`)

## Sign-in (existing Server field — no OAuth)

- [ ] Open Flip → **Use app password instead**
- [ ] Handle: full staging handle
- [ ] App password: account password (Phase 0) or PDS app password if created
- [ ] Server: staging PDS host (`http://127.0.0.1:2583` or VPS URL)
- [ ] Sign-in succeeds; profile loads (avatar may be empty)

| Result | Notes |
|--------|-------|
| Pass / Fail | |

**Common failures**

| Symptom | Likely cause |
|---------|----------------|
| `AuthenticationRequired` / login failed | Wrong password, handle not on PDS, or Server URL wrong (need `http://` for local) |
| Network error | Device cannot reach PDS (firewall, used `127.0.0.1` from phone) |
| Certificate error | Self-signed TLS on VPS — use dev build network config or proper cert |

## Photo post (Phase 0 scope)

Use any Flip flow that sets `isPhoto: true` on `uploadMediaPost` (camera photo or library image if available).

- [ ] Capture or pick a **photo** (not video)
- [ ] Add optional caption
- [ ] Upload completes without `video.bsky.app` errors
- [ ] Post returns `at://` URI

| Result | Post URI | Notes |
|--------|----------|-------|
| | | |

**Expected upload path (main branch `src/atproto/upload.ts`)**

- Photo: `agent.uploadBlob` → user's PDS → `agent.post` with `app.bsky.embed.images`
- **Does not** call `video.bsky.app`

**Document failures here**

```
(failure description, log snippet, HTTP status)
```

## Video (explicitly deferred — expect failure)

- [ ] Optional: attempt short video post to confirm failure mode

| Result | Error message |
|--------|---------------|
| Expected fail | `video.bsky.app` — staging DIDs not supported |

## Feed / timeline (informational — not Phase 0 gate)

- [ ] Home feed may be empty or Bluesky-only — **OK for Phase 0**
- [ ] Own profile may show photo post if profile reader hits PDS directly

## Relay follow (see README)

After photo spike, repeat with second account and follow test (document in implementation log).

## Sign-off

| Tester | Date | Photo post | Follow spike |
|--------|------|------------|--------------|
| | | | |
