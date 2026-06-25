# Phase 0: Staging PDS Spike — Flip-Native Signup

## Goal

Prove a Flip-created AT Protocol account can sign in to the dev build and
post a photo. This validates the path for invite-only Flip-native accounts
before any production deployment, auth rewrite, or signup UI.

## Exit Criteria

- Test user (e.g. `alice.staging.flip.app`) signs into Flip dev build
- Photo post succeeds via `uploadBlob` to staging PDS
- Two test accounts can follow each other (relay-only)

## Validated Decisions (from Issue #24)

| Decision | Rationale |
|----------|-----------|
| Photo only in Phase 0 | `video.bsky.app` won't work for Flip DIDs |
| Direct `createAccount` on staging PDS | No backend proxy until Phase 1 |
| Relay-only for follow test | No custom App View needed for two accounts |
| No auth rewrite | Existing Server field + app password path works |
| No signup UI | Manual scripts for Phase 0 |
| Branch from `main` | Keep camera OOM work separate |

## Steps

### 0.1 — Stand Up Staging PDS (Infra)

Deploy an invite-only PDS instance at `staging.flip.app`:

- Use the [Bluesky PDS Docker image](https://github.com/bluesky-social/pds)
- Set `PDS_INVITE_REQUIRED=true`
- Configure DNS + TLS
- See `scripts/staging-pds/README.md` for Docker instructions

### 0.2 — Create Test Account

Use `scripts/staging-pds/create-test-account.sh` (or `.ps1`):

```bash
export STAGING_PDS_HOST=staging.flip.app
export STAGING_PDS_INVITE=<invite-code>
export STAGING_HANDLE=alice
./scripts/staging-pds/create-test-account.sh
```

This calls `com.atproto.server.createAccount` directly on the staging PDS.

### 0.3 — Sign In from Dev Build

1. Open Flip dev build on device
2. Tap "Use app password instead"
3. Enter handle: `alice.staging.flip.app`
4. Enter app password
5. Enter server: `staging.flip.app`
6. Tap "Sign in"

The existing `loginWithPassword` in `auth.ts` calls `setServiceUrl(service)`
which points the agent at the staging PDS. No code changes required.

In `__DEV__` mode with `EXPO_PUBLIC_FLIP_STAGING_PDS_HOST` set, the Server
field will be prefilled automatically.

### 0.4 — Photo Post Test

After sign-in:
1. Tap "Flip It" (camera)
2. Take a photo
3. Post it

The upload path (`upload.ts`) uses `agent.uploadBlob` which sends directly to
the agent's PDS. Photos do NOT route through `video.bsky.app`, so this works
with any PDS.

### 0.5 — Follow Test (Two Accounts)

1. Create a second test account (e.g. `bob.staging.flip.app`)
2. Sign in as Alice, follow Bob
3. Sign in as Bob, verify Alice appears in followers

The PDS relays follow events. Without a full App View, the feed won't
aggregate posts, but the follow graph works.

### 0.6 — Decision Document

After validating 0.1–0.5, document:
- Partner PDS vs self-host for production
- Video upload strategy (custom service or defer)
- Indexer/App View scope (relay-only vs thin custom)

## What Will NOT Work (Known)

| Feature | Reason | When to fix |
|---------|--------|-------------|
| Video upload | Hardcoded `video.bsky.app` | Phase 1+ |
| Discover/search | Bluesky App View only indexes `bsky.social` accounts | Phase 1+ |
| OAuth ("Continue with Bluesky") | OAuth client resolves against `bsky.social` | Phase 1+ |
| Feed generation | No custom feed generator for staging PDS | Phase 1+ |

## Files Changed (Phase 0 Scaffold)

| File | Change |
|------|--------|
| `src/atproto/identifiers.ts` | Added `staging.flip.app` to `BLUESKY_PDS_HOSTS` |
| `src/constants/stagingPds.ts` | Staging PDS host/URL/handle-suffix constants |
| `app.json` | Added `flipStagingPdsHost` / `flipStagingHandleDomain` to extras |
| `.env.example` | `EXPO_PUBLIC_FLIP_STAGING_PDS_HOST` placeholder |
| `src/app/sign-in.tsx` | `__DEV__` prefill Server field when staging host configured |
| `scripts/staging-pds/` | README, `create-test-account.sh`, `create-test-account.ps1` |
| `docs/PHASE_0_STAGING_PDS_SPIKE.md` | This document |

## Explicitly NOT Changed

- `src/atproto/auth.ts` — no auth rewrite
- `src/atproto/upload.ts` — no video path changes
- `src/app/create-account.tsx` — no signup UI
- OAuth client files — no OAuth changes
- No native Android rebuild required

## Rollback

All Phase 0 changes are additive. To revert:
1. Remove `staging.flip.app` from `BLUESKY_PDS_HOSTS`
2. Delete `src/constants/stagingPds.ts`
3. Remove `flipStagingPdsHost`/`flipStagingHandleDomain` from `app.json`
4. Remove staging prefill logic from `sign-in.tsx`
5. Delete `scripts/staging-pds/`
6. Stop the staging PDS Docker container
