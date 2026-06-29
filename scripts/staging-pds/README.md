# Staging PDS — Flip-Native Signup (Phase 0)

Invite-only staging PDS for Flip-native account creation spike.

## Overview

Phase 0 proves a Flip-created AT Protocol account can sign into the dev build
and post a photo. No production PDS, no auth rewrite, no public registration.

## Prerequisites

- Docker (or a VPS with ports 443/2583 open)
- DNS record: `staging.flip.app` → server IP
- TLS certificate (Let's Encrypt or similar)
- Node.js 20+ (for scripts)

## Quick Start (Local Docker)

```bash
# 1. Pull the indigo PDS image
docker pull ghcr.io/bluesky-social/pds:latest

# 2. Run the PDS locally
docker run -d \
  --name flip-staging-pds \
  -p 2583:2583 \
  -e PDS_HOSTNAME=staging.flip.app \
  -e PDS_ADMIN_PASSWORD=<your-admin-password> \
  -e PDS_JWT_SECRET=<generate-a-secret> \
  -e PDS_INVITE_REQUIRED=true \
  -e PDS_DID_PLC_URL=https://plc.directory \
  -e PDS_BSKY_APP_VIEW_URL=https://api.bsky.app \
  -e PDS_BSKY_APP_VIEW_DID=did:web:api.bsky.app \
  -e PDS_REPORT_SERVICE_URL=https://mod.bsky.app \
  -e PDS_REPORT_SERVICE_DID=did:plc:ar7c4by46qjdydhdevvrndac \
  ghcr.io/bluesky-social/pds:latest

# 3. Create an invite code
curl -X POST http://localhost:2583/xrpc/com.atproto.server.createInviteCode \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'admin:<your-admin-password>' | base64)" \
  -d '{"useCount": 1}'

# 4. Create a test account (use the script below)
./create-test-account.sh
```

## Create Test Account

Use `create-test-account.sh` (or `.ps1` on Windows) to call
`com.atproto.server.createAccount` against the staging PDS.

Required environment variables:
- `STAGING_PDS_HOST` — PDS hostname (default: `localhost:2583`)
- `STAGING_PDS_INVITE` — invite code from step 3

## Sign In from Dev Build

1. Open the Flip dev build
2. Tap "Use app password instead"
3. Enter the staging account handle (e.g. `alice.staging.flip.app`)
4. Enter the app password
5. In the "Server (optional)" field, enter: `staging.flip.app`
6. Tap "Sign in"

## Photo Post Test

After sign-in, the existing `uploadBlob` → PDS path works for photos.
Video is explicitly deferred (uses `video.bsky.app` which won't work for
non-Bluesky DIDs).

## Relay-Only Follow Test

Two test accounts on the same staging PDS can follow each other via the
relay without needing a full App View. The PDS relays events to
`wss://bsky.network` (Bluesky relay).

## Security Notes

- PDS admin password must NEVER be in the mobile app or committed to git
- Invite codes are single-use; generate per test account
- Staging PDS is isolated from production
- No user data from `bsky.social` is accessible on staging

## Rollback

Stop the Docker container. No production impact.

```bash
docker stop flip-staging-pds
docker rm flip-staging-pds
```
