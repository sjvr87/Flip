# Staging PDS — Phase 0 spike

Plain-English guide for standing up a **private AT Protocol Personal Data Server (PDS)** so Flip can test invite-only account creation and app-password login **without** touching production Bluesky infrastructure.

## What is a staging PDS?

A PDS is where an AT Protocol account's data lives (profile, posts, follows). Bluesky's public network uses `bsky.social` as the default PDS. For Flip-native signup Phase 0 we run our **own** PDS (staging only) so we can:

- Call `com.atproto.server.createAccount` directly (invite-only)
- Sign into Flip via the existing **Server** field + app password (no OAuth rewrite)
- Post **photos** to the user's repo on that PDS
- Test **follow** edges via the public relay (no custom App View required)

**Never** put PDS admin secrets, invite signing keys, or service JWTs in the Flip mobile app. Account creation is a **server-side or operator script** concern in Phase 0.

## Quick start — local indigo PDS (Docker)

[Indigo](https://github.com/bluesky-social/indigo) is Bluesky's reference ATProto stack. The `pds` service is the piece Flip needs.

### Prerequisites

- Docker Desktop (or Docker on a Linux VPS)
- A handle domain you control (for production-like tests) **or** `localhost` / LAN IP for dev-only

### Run PDS locally (default port 2583)

Follow the current [indigo PDS README](https://github.com/bluesky-social/indigo/tree/main/cmd/pds) for the exact `docker compose` or binary flags. Typical local defaults:

| Setting | Default |
|---------|---------|
| PDS HTTP | `http://127.0.0.1:2583` |
| Handle domain | configured at deploy time (e.g. `staging.flip.app`) |

Set Flip dev config to match (see repo root `.env.example` and `app.json` `extra.flipStagingPdsHost`).

**Phone testing:** `127.0.0.1` only works on the same machine as Metro. For a physical device, use your PC's LAN IP (e.g. `http://192.168.1.42:2583`) and ensure the PDS binds `0.0.0.0` and Windows Firewall allows the port.

### VPS option

Same indigo `pds` image on a small VPS. Terminate TLS at Caddy/nginx (`https://pds.staging.example.com`). Point `flipStagingPdsHost` at that URL. Restrict firewall to your IP during Phase 0.

## Invite-only `createAccount` flow

Phase 0 uses **direct** `com.atproto.server.createAccount` against the staging PDS (backend proxy deferred to Phase 1).

1. **Bootstrap admin** on the PDS (first account or admin CLI — see indigo docs).
2. **Create invite codes** via admin API (`com.atproto.server.createInviteCode` or PDS admin tooling).
3. **Run** `create-test-account.ps1` or `create-test-account.sh` with:
   - `STAGING_PDS_HOST` — e.g. `http://127.0.0.1:2583`
   - `STAGING_HANDLE` — e.g. `alice.staging.flip.app` (must match PDS handle domain)
   - `STAGING_INVITE_CODE` — from step 2
   - `STAGING_PASSWORD` — operator-chosen password (script can generate one)
4. Script prints **handle** and **app password** (or login password — create a dedicated app password in PDS if supported; otherwise use account password for Phase 0 manual login only on staging).
5. In Flip dev build: **Use app password instead** → enter handle, password, and **Server** = staging host (pre-filled in `__DEV__` when configured).

### XRPC reference

```http
POST {STAGING_PDS_HOST}/xrpc/com.atproto.server.createAccount
Content-Type: application/json

{
  "email": "alice@example.com",
  "handle": "alice.staging.flip.app",
  "password": "<password>",
  "inviteCode": "<invite-code>"
}
```

Success returns `did`, `handle`, `accessJwt`, `refreshJwt`. The Flip app does **not** call this in Phase 0 — only the operator script does.

## Relay-only follow test (no App View)

Phase 0 does **not** require a custom Flip App View or `api.bsky.app` proxy. To verify social graph on staging:

### Setup

1. Create **two** test accounts on the same staging PDS (`alice…`, `bob…`) via `create-test-account` script.
2. Sign in as Alice in Flip (app password + Server field).
3. Follow Bob using Flip's existing follow UI, **or** call `com.atproto.repo.createRecord` with collection `app.bsky.graph.follow` and `subject` = Bob's DID.

### Why relay-only is enough for Phase 0

- Follow records live in each user's repo on the PDS.
- The **public relay** (`https://bsky.network` / `wss://bsky.network`) ingests repo commits from PDS firehoses that are configured to emit to it (indigo PDS can be configured accordingly; for isolated staging you may use a dedicated relay or verify follows directly on the PDS via `com.atproto.repo.listRecords`).
- Flip's **home timeline** may still be Bluesky-centric (`did:web:api.bsky.app#bsky_appview`) — that is expected to break or show empty for staging DIDs in Phase 0. **Success criteria** for follow spike: follow record exists on PDS + visible in relay subscription or `describeRepo` / profile follower counts if indexed.

### Manual verification checklist

| Step | Check |
|------|--------|
| Alice follows Bob | `app.bsky.graph.follow` record in Alice's repo |
| Bob's profile | `followersCount` increments (PDS or relay-backed query) |
| Flip UI | Follow button state updates (may need pull-to-refresh) |
| Feed | **Not** required for Phase 0 — timeline may be empty off bsky App View |

Document results in `spike-photo-post.md` and `.github/handoffs/phase0-implementation-log.md`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `STAGING_PDS_HOST` | PDS base URL for scripts (e.g. `http://127.0.0.1:2583`) |
| `STAGING_HANDLE` | Full handle for new account |
| `STAGING_EMAIL` | Email for `createAccount` |
| `STAGING_PASSWORD` | Account password (optional — script generates if unset) |
| `STAGING_INVITE_CODE` | Invite code from PDS admin |
| `EXPO_PUBLIC_FLIP_STAGING_PDS_HOST` | Flip dev prefill for Server field |
| `EXPO_PUBLIC_FLIP_STAGING_HANDLE_DOMAIN` | Docs / script placeholder (e.g. `staging.flip.app`) |

## Related files

- `create-test-account.ps1` / `create-test-account.sh` — operator account creation
- `spike-photo-post.md` — manual photo post test checklist
- `.github/handoffs/phase0-implementation-log.md` — session progress log
- GitHub [#24](https://github.com/sjvr87/Flip/issues/24) — Copilot handoff thread

## Explicitly out of scope (Phase 0)

- Production PDS deploy
- `video.bsky.app` video upload for staging DIDs (photo only)
- OAuth / `auth.ts` rewrite
- In-app signup UI
- Backend signup proxy (Phase 1)
