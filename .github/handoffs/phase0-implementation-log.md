# Phase 0 implementation log — Flip-native signup

| Field | Value |
|-------|-------|
| **Branch** | `phase0/flip-native-signup` (from `origin/main`) |
| **Started** | 2026-06-25 |
| **Copilot ack** | Phase 0 constraints validated on [#24](https://github.com/sjvr87/Flip/issues/24) |
| **Status** | **IN PROGRESS** — scaffold landed; PDS not yet stood up |

## Copilot constraints (locked)

- Branch from `main`, not `fix/camera-orientation-oom`
- No auth rewrite — existing Server field + app-password sign-in
- **Photo only** in Phase 0 — defer video
- Relay-only indexer for follow test
- Direct `createAccount` on staging PDS; backend proxy → Phase 1
- No admin secrets in mobile app

## Deliverables checklist

| # | Item | Status |
|---|------|--------|
| 1 | Branch `phase0/flip-native-signup` | Done |
| 2 | `scripts/staging-pds/` docs + scripts | Done |
| 3 | `app.json` / `.env.example` staging config | Done |
| 4 | `sign-in.tsx` dev Server prefill | Done |
| 5 | Photo upload audit (below) | Done |
| 6 | Relay follow notes in README | Done |
| 7 | Issue #24 milestone comment | Pending post-commit |
| 8 | Manual PDS stand-up + device test | **Not started** |

## Photo upload path audit (`src/atproto/upload.ts` on `main`)

### Photo — staging-compatible

When `isPhoto: true`:

1. `readFileBytes(fileUri)` — local file only
2. `agent.uploadBlob(bytes, { encoding: 'image/jpeg' })` — uploads to **authenticated user's PDS** (whatever Server was set at login)
3. `agent.post({ embed: app.bsky.embed.images, … })` — creates record on same PDS

**No `video.bsky.app` dependency for photos.** Staging PDS photo post should work if login session points at staging PDS.

### Video — blocked for staging DIDs (deferred)

`uploadVideoViaService` hardcodes:

- `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo`
- `AtpAgent({ service: 'https://video.bsky.app' })` for job polling

These require Bluesky's video pipeline and the user's DID to be known to that service. **Not used in Phase 0.**

### Other Bluesky-centric assumptions (not blocking photo Phase 0)

| Location | Assumption | Phase 0 impact |
|----------|------------|----------------|
| `agent.ts` | `configureProxy('did:web:api.bsky.app#bsky_appview')` | Feeds/timeline may not show staging posts |
| `auth.ts` / OAuth | `https://bsky.social` resolver | Bypassed when using app password + Server field |
| `identifiers.ts` | Default `.bsky.social` suffix | Use full staging handle at login |
| `adapters.ts` | `video.bsky.app/watch/…` URLs | Video playback links only |
| `oauthClient*.ts` | Bluesky OAuth origins | Unused for staging app-password login |

### Phase 0 photo verdict

**Proceed** — photo upload path is PDS-local via `uploadBlob`; no code change required for first staging spike.

## Session notes

- Camera OOM branch work stashed as `phase0-branch-prep: camera OOM WIP` before branching from `main`
- No native rebuild this session (JS/docs/scripts only)
- No production PDS deploy

## Next manual steps (operator)

1. Stand up indigo PDS locally or on VPS — see `scripts/staging-pds/README.md`
2. Create invite code via PDS admin
3. Run `scripts/staging-pds/create-test-account.ps1`
4. Set `EXPO_PUBLIC_FLIP_STAGING_PDS_HOST` or `app.json` `flipStagingPdsHost`
5. Flip dev build → app password login → photo post per `spike-photo-post.md`
6. Second account + follow test (relay-only criteria in README)

## Exit criteria (unchanged)

Test user e.g. `alice.staging.flip.app` signs into Flip dev build and posts a **photo**.
