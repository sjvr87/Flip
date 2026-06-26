# Phase 1 Multiverse — rollout and operations

United multiverse MVP: one canonical Flip post fans out to connected social destinations. **ATProto (Bluesky) is the only live external provider** in Phase 1. Nostr and ActivityPub are registered scaffolds — connect/delivery return `NOT_IMPLEMENTED` and never fake a successful send.

Epic: [#42](https://github.com/sjvr87/Flip/issues/42) · v2 tracker: [#55](https://github.com/sjvr87/Flip/issues/55)–[#62](https://github.com/sjvr87/Flip/issues/62)

## Execution order (8 steps)

| Step | Issue | Scope |
|------|-------|--------|
| 1 | #55 | Provider abstraction + registry |
| 2 | #56 | SQLite schema + migrations |
| 3 | #57 | Token encryption + secret-safe logging |
| 4 | #58 | Connected accounts APIs |
| 5 | #59 | Post creation + delivery fanout plan |
| 6 | #60 | Async delivery worker |
| 7 | #61 | Client UI (accounts, composer, status panel) |
| 8 | #62 | Feature flags, tests, CI, this doc |

## Local development

### Server

```bash
npm run multiverse:install
cp server/.env.example server/.env   # set FLIP_TOKEN_ENCRYPTION_KEY (≥32 chars)
npm run multiverse:dev                 # API on :8788, migrations on boot
```

CLI migration (optional — boot already runs `schema.sql` idempotently):

```bash
npm run multiverse:dev --prefix server  # or: cd server && npm run migrate
```

### Client

Set in `app.json` `extra` or env:

- `EXPO_PUBLIC_FLIP_API_URL` — multiverse API base (default `http://127.0.0.1:8788`)
- `flipMultiverseEnabled: true` in `app.json` extra

Physical Android: `adb reverse tcp:8788 tcp:8788` or use your PC LAN IP.

### Tests

```bash
npm run multiverse:test
```

## Environment variables

### Server (required)

| Variable | Purpose |
|----------|---------|
| `FLIP_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key material (min 32 chars); never commit real values |

### Server (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `FLIP_API_PORT` / `PORT` | `8788` | HTTP listen port |
| `FLIP_DB_PATH` | `./data/flip-multiverse.db` | SQLite file path |
| `FLIP_DELIVERY_MAX_ATTEMPTS` | `5` | Max delivery retries |
| `FF_PROVIDER_ATPROTO` | `true` | Bluesky / ATProto linking + delivery |
| `FF_PROVIDER_NOSTR` | `false` | Nostr scaffold (off by default) |
| `FF_PROVIDER_ACTIVITYPUB` | `false` | ActivityPub scaffold (off by default) |

### Client (Expo)

| Variable | Default | Purpose |
|----------|---------|---------|
| `EXPO_PUBLIC_FLIP_API_URL` | from `app.json` extra | API base URL |
| `EXPO_PUBLIC_FF_PROVIDER_ATPROTO` | `true` | Show/link ATProto in UI |
| `EXPO_PUBLIC_FF_PROVIDER_NOSTR` | `false` | Nostr beta UI (disabled) |
| `EXPO_PUBLIC_FF_PROVIDER_ACTIVITYPUB` | `false` | ActivityPub beta UI (disabled) |

See `server/.env.example` for a copy-paste template.

## Database schema (migration summary)

SQLite via `sql.js`, file persisted at `FLIP_DB_PATH`. On server boot, `runMigrations()` executes `server/src/db/schema.sql` (`CREATE IF NOT EXISTS`) plus incremental alters.

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Flip user identity (`did`, optional `handle`) |
| `flip_sessions` | Bearer session tokens for multiverse API |
| `external_accounts` | Linked provider accounts; JWTs encrypted at rest |
| `posts` | Canonical post body + optional Flip `flip_post_uri` |
| `post_deliveries` | Per-destination delivery row with retry state |

### `external_accounts`

- `user_id`, `provider`, `handle` (unique per user)
- `access_token_encrypted`, `refresh_token_encrypted`
- `metadata_json` (e.g. ATProto `did`, Nostr `pubkey`/`relays`)
- `status`: `active` \| `revoked` \| `error`

### `posts`

- `body_text`, `media_type`, `media_uri`, optional `flip_post_uri`

### `post_deliveries`

- `post_id`, `provider`, `destination_account_id`, `destination` (JSON relay/actor target)
- `status`: `pending` \| `sent` \| `failed` \| `not_implemented`
- `remote_post_id`, `error_message`, `attempt_count`
- `idempotency_key` (unique): `{postId}:{provider}:{accountId|native}`
- `last_attempt_at`, `next_attempt_at` for backoff worker

### Indexes

- `external_accounts(user_id)`
- `posts(user_id)`
- `post_deliveries(post_id)`
- `post_deliveries(status, next_attempt_at)` — pending queue

### Incremental migrations

- `post_deliveries.destination` added via `ALTER TABLE` if missing (upgrades pre-destination DBs).

Types: `server/src/types.ts` mirrors column names.

## Feature flags and safe defaults

**ATProto-only rollout (recommended):**

```env
FF_PROVIDER_ATPROTO=true
FF_PROVIDER_NOSTR=false
FF_PROVIDER_ACTIVITYPUB=false
```

Scaffold providers (`nostr`, `activitypub`):

- Registered in the provider registry for API/UI wiring
- `shouldGuardDelivery()` marks deliveries `not_implemented` without network calls when flags are off or provider is scaffold
- Enabling `FF_PROVIDER_NOSTR=true` exposes beta UI but callback/createPost still throw `NOT_IMPLEMENTED`

Health check `GET /health` returns current flag states.

## API surface

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/session/bootstrap` | — |
| GET | `/api/accounts` | Bearer |
| POST | `/api/accounts/connect/:provider` | Bearer |
| POST | `/api/accounts/callback/:provider` | Bearer |
| DELETE | `/api/accounts/:accountId` | Bearer |
| POST | `/api/posts` | Bearer |
| GET | `/api/posts/:id/deliveries` | Bearer |

Provider aliases: `flip` → `flip_local`, `bluesky` → `atproto`.

## QA checklist

- [ ] Server starts with `FLIP_TOKEN_ENCRYPTION_KEY` set; `/health` returns `ok: true`
- [ ] Bootstrap session from app; Settings → Connected accounts loads
- [ ] Link Bluesky via app password; account appears as `active`
- [ ] Composer shows Flip + linked ATProto destination; post creates `flip_local` + `atproto` deliveries
- [ ] Delivery panel shows `sent` for Flip; ATProto `sent` or retryable `pending`/`failed` with redacted errors
- [ ] Unlink account sets status `revoked`; no tokens in API list response
- [ ] With `FF_PROVIDER_NOSTR=false`, Nostr does not appear as connect option
- [ ] With scaffold enabled, Nostr delivery ends `not_implemented` (never `sent` without real publish)
- [ ] `npm run multiverse:test` passes locally and in CI

## Known limitations (Phase 1)

- **Media cross-post**: ATProto `createPost` sends text only; Flip media URI is not uploaded to Bluesky yet
- **Nostr / ActivityPub**: scaffold only — no key storage, relay publish, or federation
- **OAuth**: ATProto uses app-password flow, not OAuth PAR
- **Session**: multiverse API uses its own `flip_sessions` bearer tokens, separate from Flip ATProto OAuth session
- **Single SQLite file**: no horizontal scale; suitable for dev / single-node beta
- **Delivery worker**: in-process interval (30s); no external queue (Redis, etc.)

## CI

Pull requests touching `server/**` run `npm run multiverse:test` via `.github/workflows/multiverse-test.yml`.
