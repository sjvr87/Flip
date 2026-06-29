# Phase 0: Staging PDS Spike (Invite-Only)

This spike validates Flip-native signup without changing production auth flows.

## Scope

- Keep existing Bluesky OAuth and app-password login flows unchanged.
- Use sign-in `Server (optional)` to point at staging PDS host.
- Validate photo posting only in Phase 0.
- Defer video posting (`video.bsky.app` is Bluesky-specific).
- No signup UI rewrite, no `auth.ts` rewrite, no production PDS deploy.

## Preconditions

- Staging PDS host is online (example: `staging.flip.app`) with TLS.
- Invite codes are enabled and available on staging PDS.
- You have operator credentials for the staging PDS admin API.

## Step 0.1: Stand up staging PDS

1. Deploy ATProto PDS in staging only.
2. Configure hostname, TLS certs, and email sender.
3. Confirm health and that `com.atproto.server.createAccount` works with invite codes.

## Step 0.2: Create test account directly on PDS

1. Generate an invite code on staging PDS.
2. Create at least one test account with a handle under `staging.flip.app`.
3. Save the generated app password for sign-in tests.

## Step 0.3: Manual app login test (no auth rewrite)

1. Open Flip dev build sign-in screen.
2. Choose app-password path.
3. Enter:
    - Handle/email
    - App password
    - `Server (optional)` as the staging PDS host
4. Confirm successful session creation.

## Step 0.4: Photo posting spike

1. Create and publish a photo post from the staging account.
2. Confirm post exists and media blob resolves from staging PDS.

## Step 0.5: Follow spike (relay-only)

1. Create a second staging account.
2. Perform a follow between the two staging accounts.
3. Confirm visibility in Flip for this limited test setup.

## Exit criteria

- A staging handle (example: `alice.staging.flip.app`) can sign in from Flip dev build.
- That account can publish a photo post successfully.

## Explicit deferrals

- Video posting path changes.
- Production signup API and backend proxy.
- Public registration UI.
- OAuth path rewrite for non-Bluesky resolvers.
