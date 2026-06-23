# OAuth client metadata hosting (flip.app)

Bluesky OAuth uses a **hosted client metadata document** as `client_id`:

`https://flip.app/oauth-client-metadata.json`

The native app loads the same JSON from `assets/oauth-client-metadata.json` at build time. The **public URL must return JSON** (`Content-Type: application/json`), not the Flip web SPA shell.

## Source of truth

| Path | Purpose |
|------|---------|
| `assets/oauth-client-metadata.json` | Bundled into the app (`src/atproto/oauthClient.ts`) |
| `public/oauth-client-metadata.json` | Copied into web export / dev static hosting |
| `dist/oauth-client-metadata.json` | Deployed to Heroku (after export + sync) |

Keep them in sync:

```bash
npm run web:oauth-metadata
npm run web:oauth-metadata -- --dist   # also copy into dist/
```

## Current production issue

`flip.app` is an Expo **single-page app** on **Heroku** (behind Cloudflare). A catch-all route serves `index.html` for every path, so `/oauth-client-metadata.json` currently returns **HTML** and OAuth sign-in fails.

This repo now includes hosting config so the next deploy serves the JSON file correctly.

## Deploy flip.app (Heroku)

1. Build the web export (when web bundling is healthy):

   ```bash
   npx expo export --platform web
   ```

2. Copy OAuth metadata into `dist/`:

   ```bash
   npm run web:oauth-metadata -- --dist
   ```

3. Deploy to Heroku (existing flip.app app).

   **Option A — `heroku-buildpack-static`** (uses `static.json` in repo root):

   - `static.json` routes `/oauth-client-metadata.json` to the file **before** the `/**` → `index.html` SPA fallback.
   - Ensure `dist/oauth-client-metadata.json` exists in the slug.

   **Option B — Node `Procfile`** (uses `server.js`):

   - `Procfile`: `web: node server.js`
   - `server.js` serves `dist/oauth-client-metadata.json` with `application/json` before SPA fallback.

4. Verify after deploy:

   ```bash
   curl -sI https://flip.app/oauth-client-metadata.json
   # Content-Type: application/json

   curl -s https://flip.app/oauth-client-metadata.json | jq .
   # redirect_uris includes "app.flip:/oauth/callback"
   ```

Until this deploy completes, **Skylight OAuth on device will fail** even with a correct native build.

## Local web dev

Expo serves files from `public/` at the site root during `npm run web`.

```bash
npm run web:oauth-metadata
npm run web
# http://localhost:8081/oauth-client-metadata.json
```

## Vercel / other hosts

`vercel.json` sets JSON headers for `/oauth-client-metadata.json`. Static files in the export output are served before SPA rewrites on Vercel.

## Editing metadata

1. Edit `assets/oauth-client-metadata.json`.
2. Run `npm run web:oauth-metadata` (and `-- --dist` before deploy).
3. Redeploy flip.app.
4. Rebuild the native app if `redirect_uris` or `client_id` changed.
