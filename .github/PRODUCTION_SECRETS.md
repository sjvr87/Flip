# Production secrets — Flip multiverse API

Secrets for the Phase 1 multiverse server (`server/`). **Never commit real values to git.**

## Current deployment status

| Component | Host | Notes |
|-----------|------|-------|
| Multiverse API (`server/`) | **Not deployed** | Local dev only (`npm run multiverse:dev`, port 8788) |
| flip.app web / OAuth metadata | Heroku (intended) | `.github/workflows/deploy-web.yml` — static `dist/`, not multiverse |
| Mobile app | EAS / local Metro | Points at `EXPO_PUBLIC_FLIP_API_URL` |

Until the multiverse API is deployed, `FLIP_TOKEN_ENCRYPTION_KEY` is only needed in `server/.env` for local development.

## Required runtime variables

| Variable | Required | Notes |
|----------|----------|-------|
| `FLIP_TOKEN_ENCRYPTION_KEY` | **Yes** | Min 32 characters; AES-256-GCM key material (hashed with SHA-256 at runtime) |
| `FF_PROVIDER_ATPROTO` | Recommended | `true` — only live external provider in Phase 1 |
| `FF_PROVIDER_NOSTR` | Recommended | `false` |
| `FF_PROVIDER_ACTIVITYPUB` | Recommended | `false` |

## Optional runtime variables

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` / `FLIP_API_PORT` | `8788` | HTTP listen port (hosts like Heroku/Fly set `PORT` automatically) |
| `FLIP_DB_PATH` | `./data/flip-multiverse.db` | **Must be on persistent disk** in production |
| `FLIP_DELIVERY_MAX_ATTEMPTS` | `5` | Delivery retry cap |

## Generate a key (run locally, store in password manager)

```bash
# OpenSSL
openssl rand -base64 32

# Node (Windows-friendly)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Use the generated string as `FLIP_TOKEN_ENCRYPTION_KEY`. Do not paste it into issues, PRs, or chat logs.

## Set secrets on your host

Replace `YOUR_KEY` with the generated value. **Do not commit `YOUR_KEY`.**

### Heroku

```bash
heroku config:set FLIP_TOKEN_ENCRYPTION_KEY="YOUR_KEY" -a YOUR_MULTIVERSE_APP
heroku config:set FF_PROVIDER_ATPROTO=true -a YOUR_MULTIVERSE_APP
heroku config:set FF_PROVIDER_NOSTR=false -a YOUR_MULTIVERSE_APP
heroku config:set FF_PROVIDER_ACTIVITYPUB=false -a YOUR_MULTIVERSE_APP
# Persistent SQLite (example addon path)
heroku config:set FLIP_DB_PATH=/app/data/flip-multiverse.db -a YOUR_MULTIVERSE_APP
```

Check without printing values:

```bash
heroku config:get FLIP_TOKEN_ENCRYPTION_KEY -a YOUR_MULTIVERSE_APP | wc -c
# Should be > 32 (includes newline)
heroku config -a YOUR_MULTIVERSE_APP | grep -E '^(FF_PROVIDER_|FLIP_TOKEN)'
```

### Fly.io

```bash
fly secrets set \
  FLIP_TOKEN_ENCRYPTION_KEY="YOUR_KEY" \
  FF_PROVIDER_ATPROTO=true \
  FF_PROVIDER_NOSTR=false \
  FF_PROVIDER_ACTIVITYPUB=false \
  -a YOUR_MULTIVERSE_APP
```

Mount a volume for SQLite in `fly.toml` and set `FLIP_DB_PATH` to that mount.

### Railway

```bash
railway variables set FLIP_TOKEN_ENCRYPTION_KEY="YOUR_KEY"
railway variables set FF_PROVIDER_ATPROTO=true
railway variables set FF_PROVIDER_NOSTR=false
railway variables set FF_PROVIDER_ACTIVITYPUB=false
```

Or use the Railway dashboard → Service → Variables.

### Render

Dashboard → Service → Environment → add the four variables above. Attach a persistent disk and set `FLIP_DB_PATH`.

### VPS / Docker

```bash
# /etc/flip-multiverse.env (chmod 600, root-only)
FLIP_TOKEN_ENCRYPTION_KEY=YOUR_KEY
FF_PROVIDER_ATPROTO=true
FF_PROVIDER_NOSTR=false
FF_PROVIDER_ACTIVITYPUB=false
FLIP_DB_PATH=/var/lib/flip/flip-multiverse.db
PORT=8788
```

```bash
cd server
npm ci
npm run start
# Or: systemd unit / docker compose with env_file pointing at the file above
```

## Client configuration (after API is live)

Set the public API URL in EAS secrets or `app.json` `extra`:

```json
"flipMultiverseApiUrl": "https://api.flip.app",
"flipMultiverseEnabled": true
```

Or build-time env:

```bash
EXPO_PUBLIC_FLIP_API_URL=https://api.flip.app
```

## Verify deployment

```bash
curl -s https://YOUR_API_HOST/health
```

Expected shape (values may vary):

```json
{
  "ok": true,
  "providers": {
    "atproto": true,
    "nostr": false,
    "activitypub": false
  }
}
```

Linking a Bluesky account exercises encryption — if `FLIP_TOKEN_ENCRYPTION_KEY` is wrong or missing, connect/callback will fail with a server error.

## GitHub Actions / CI

| Secret | In repo today? | Purpose |
|--------|----------------|---------|
| `FLIP_TOKEN_ENCRYPTION_KEY` | **No** | Not needed for CI — workflow uses inline test key |
| `HEROKU_API_KEY` | **No** (not in `gh secret list`) | flip.app web deploy only |
| Firebase secrets | Yes | Internal testing builds |

Do **not** add `FLIP_TOKEN_ENCRYPTION_KEY` to GitHub repo secrets unless you add an automated multiverse deploy workflow that injects it into the target host.

## Key rotation

1. Deploy new key to the host (or add a migration path if you implement dual-key decrypt later — not in Phase 1).
2. **Re-link** all connected external accounts (old ciphertext cannot be decrypted with a new key).
3. Restart the server process.

## Related docs

- [`docs/PHASE1_MULTIVERSE.md`](../docs/PHASE1_MULTIVERSE.md) — rollout, schema, QA
- [`server/.env.example`](../server/.env.example) — local dev template
