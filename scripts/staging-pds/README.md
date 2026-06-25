# Staging PDS — operator guide (Phase 0)

Spin up an invite-only AT Protocol PDS for Flip test accounts.  
All steps are local-first; no production changes required.

---

## 1 — Stand up a local PDS (indigo)

```powershell
# Windows / WSL — requires Docker Desktop
docker run -d --name flip-staging-pds \
  -p 2583:3000 \
  -e PDS_HOSTNAME=localhost \
  -e PDS_JWT_SECRET=change-me-local \
  -e PDS_ADMIN_PASSWORD=change-me-local \
  -e PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX=<generate> \
  ghcr.io/bluesky-social/pds:latest
```

Or follow the [official indigo PDS guide](https://github.com/bluesky-social/pds) for a VPS deploy.

**Staging host (local):** `http://127.0.0.1:2583`  
**Staging host (VPS):**   `https://staging.flip.app`

---

## 2 — Create an invite code (admin)

```bash
curl -s -X POST http://127.0.0.1:2583/xrpc/com.atproto.server.createInviteCode \
  -H "Authorization: Basic $(echo -n 'admin:change-me-local' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"useCount":1}' | jq .code
```

Save the returned code; you need it in Step 3.

---

## 3 — Create a test account

See `create-test-account.ps1` (Windows) or `create-test-account.sh` (macOS/Linux).

Set environment variables before running:

| Variable | Example |
|----------|---------|
| `STAGING_PDS_HOST` | `http://127.0.0.1:2583` |
| `STAGING_HANDLE` | `alice` |
| `STAGING_EMAIL` | `alice@example.com` |
| `STAGING_PASSWORD` | `alice-app-password` |
| `STAGING_INVITE_CODE` | `<code from Step 2>` |

---

## 4 — Sign in via the Flip dev build

1. Open Flip dev build on device / emulator.
2. Tap **Use app password instead** on the sign-in screen.
3. Enter handle: `alice.staging.flip.app` (or the handle returned by the script).
4. Enter app password set in Step 3.
5. **Server (optional)** field should be pre-filled with `staging.flip.app` in `__DEV__`
   builds (or enter `http://127.0.0.1:2583` for a local PDS).
6. Tap **Sign in**.

---

## 5 — Relay-only follow test (Phase 0)

Create a second account (`bob`) following the same steps.  
Use the Bluesky relay (`https://bsky.network`) — no custom App View needed for Phase 0.

```bash
# Follow bob from alice's session (replace tokens)
curl -s -X POST http://127.0.0.1:2583/xrpc/com.atproto.repo.createRecord \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "<alice-did>",
    "collection": "app.bsky.graph.follow",
    "record": {
      "$type": "app.bsky.graph.follow",
      "subject": "<bob-did>",
      "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

---

## Phase 0 exit criteria

- [ ] `alice.staging.flip.app` signs in via dev build
- [ ] Alice posts a photo (uploadBlob → PDS → app.bsky.feed.post)
- [ ] Bob follows Alice; follow record visible in PDS repo
- [ ] No `video.bsky.app` calls during photo-only test
