# Phase 0 — staging PDS spike implementation log

**Branch:** `copilot/fixcamera-orientation-oom` (Copilot PR)  
**Validated:** ✅ (sjvr87/Flip#24)  
**Last updated:** 2026-06-25

---

## Photo upload audit (main)

| Upload path | Target | Staging-compatible? |
|-------------|--------|---------------------|
| `agent.uploadBlob` (photos) | PDS host in session | ✅ Yes |
| `video.bsky.app` upload | Hardcoded Bluesky service | ❌ No — deferred to Phase 1 |

Photo posts use `agent.uploadBlob` which resolves against the authenticated session's
PDS URL, so staging accounts automatically upload to the staging PDS.
Video upload is hardcoded to `video.bsky.app` and will not work for Flip-native DIDs —
explicitly deferred until Phase 1.

---

## App-side changes (this PR)

| File | Change |
|------|--------|
| `src/atproto/identifiers.ts` | Added `staging.flip.app` to `BLUESKY_PDS_HOSTS` |
| `src/constants/stagingPds.ts` | New — staging PDS host/URL/handle-suffix constants |
| `app.json` | Added `extra.flipStagingPdsHost` + `flipStagingHandleDomain` placeholders |
| `.env.example` | New — `EXPO_PUBLIC_FLIP_STAGING_PDS_HOST` placeholder |
| `src/app/sign-in.tsx` | `__DEV__` prefill of Server field from staging env var |
| `scripts/staging-pds/README.md` | New — operator setup guide |
| `scripts/staging-pds/create-test-account.ps1` | New — Windows account creation script |
| `scripts/staging-pds/create-test-account.sh` | New — macOS/Linux account creation script |
| `scripts/staging-pds/spike-photo-post.md` | New — manual sign-in + photo post checklist |
| `docs/PHASE_0_STAGING_PDS_SPIKE.md` | New — full spike plan |

---

## Validated decisions (from #24)

- ✅ Photo only; video deferred (video.bsky.app won't work for Flip DIDs)
- ✅ Direct `createAccount` on staging PDS — no backend proxy in Phase 0
- ✅ Relay-only for follow test (no custom App View)
- ✅ No auth rewrite, no signup UI, no native rebuild
- ✅ Server field + existing sign-in path (hidden field already passes custom PDS host)

---

## Next steps (operator — not in this PR)

1. Stand up indigo staging PDS (local Docker or VPS) — `scripts/staging-pds/README.md`
2. Generate PDS invite code (admin endpoint)
3. Run `create-test-account.ps1` / `.sh` with staging vars
4. Flip dev build → app password + Server field → photo post per `spike-photo-post.md`
5. Second test account + relay-only follow spike
6. Decision doc: partner PDS vs self-host; video strategy; indexer scope

---

## Rollback

All changes are JS/TS and docs only — no native rebuild required.  
The `__DEV__` guard in `sign-in.tsx` means staging prefill is never active in production builds.
