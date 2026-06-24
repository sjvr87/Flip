# Flip 21+ age verification

Spec for gating Flip behind government-ID–backed age verification **after** Bluesky OAuth sign-in. Client-only checks are not sufficient for US 21+ policy; a small backend owns vendor sessions, webhook trust, and per-user verification status.

## Goals

| Goal | Detail |
|------|--------|
| Order of gates | **Bluesky OAuth first** → **age verification second** → unlock app |
| Threshold | **21+** (US alcohol/cannabis-adjacent policy; stricter than generic 18+ COPPA-style gates) |
| Trust model | Vendor performs ID check; Flip backend stores only pass/fail + expiry, keyed to Bluesky DID |
| OAuth safety | No changes to OAuth client metadata, redirect URIs, or token exchange; age gate runs only after `isLoggedIn` |

## Vendor comparison (startup lens)

| Vendor | Best for | Mobile / RN | 21+ threshold | Startup pricing (indicative) | Caveats |
|--------|----------|-------------|---------------|------------------------------|---------|
| **Veriff** ★ | Document-backed age validation with RN SDK | Official [React Native SDK](https://devdocs.veriff.com/docs/react-native-sdk-guide); EAS Build | Yes — configurable min age (13–25) | Self-serve ~**$0.80–$1.89**/verification + monthly minimum; free sandbox | Returns pass/fail only (no DOB stored on Flip); ID capture UX |
| **Persona** | Configurable workflows, US compliance depth | Web + mobile embed; REST API | Yes — DOB rules in workflow | **Startup program**: 500 free verifications/mo × 12 mo; then ~**$250/mo** min + ~$1–1.50/overages | Heavier than pure age gate; 12‑month contract on paid tiers |
| **Yoti** | Age-only product (not full KYC) | Age Verification API + mobile capture SDKs | Yes — `type: "OVER", threshold: 21` in session API | Sales-led; volume-based; Digital ID can reduce cost | Multiple methods (estimation, doc scan, mobile); webhook signature verification required |
| **Onfido** (Entrust) | Enterprise KYC | iOS/Android SDKs | Yes | **$50k–$200k**/yr contracts typical | Overkill and slow procurement for early Flip |
| **ID.me** | US gov / benefits identity | Mobile + web | Yes (18+ common; 21 configurable) | Enterprise / gov pricing | Branding and UX skew government; poor fit for social video app |

### Recommendation

**Primary: Veriff Age Validation**

- Purpose-built “over 21” document check with explicit pass/fail (no DOB retention on Flip).
- React Native SDK aligns with Flip’s Expo dev client / EAS pipeline.
- Sandbox + self-serve signup unblock a POC without enterprise sales.

**Secondary: Yoti Age Verification**

- If you want a lighter “age assurance” stack (selfie estimation → step-up to ID) rather than full ID-first flow.
- Strong session API for `threshold: 21`.

**Defer: Onfido, ID.me** until scale or regulatory counsel requires enterprise KYC posture.

### What to sign up for (POC)

1. **Veriff** — create account → sandbox integration → React Native SDK credentials → webhook signing secret.
2. **Hosting** — API subdomain on Flip infra (e.g. `api.flip.app` or separate Fly.io/Railway service) with HTTPS for vendor webhooks.
3. **Database** — table keyed by `did` (Bluesky DID): `age_verified_at`, `expires_at`, `vendor`, `vendor_session_id`, `status`.
4. **Apple / Google** — privacy nutrition labels update before production (see checklist below).
5. **Legal** — privacy policy + terms addendum for ID processing (vendor as subprocessor).

---

## User flow

```mermaid
flowchart TD
    A[App launch] --> B{Hydrated + authReady?}
    B -->|no| B
    B -->|yes| C{isLoggedIn?}
    C -->|no| D[/sign-in/]
    D --> E[Bluesky OAuth]
    E --> F{OAuth success?}
    F -->|no| D
    F -->|yes| G{AGE_VERIFY_ENABLED?}
    G -->|no| H[/(tabs)/]
    G -->|yes| I{ageVerified on server?}
    I -->|yes| H
    I -->|no| J[/verify-age/]
    J --> K[POST /age-verification/session]
    K --> L[Open vendor SDK / WebView]
    L --> M[User completes ID check]
    M --> N[Vendor webhook → backend]
    N --> O[Backend marks DID verified]
    O --> P[Client polls or push → setAgeVerified]
    P --> H
```

**Cold start (returning user):** same gate — logged in but `ageVerified === false` routes to `/verify-age`, not tabs.

**Sign out:** clears local `ageVerified`; server status remains (re-login skips re-verify until expiry).

---

## Backend API sketch

Flip today serves static web on Heroku (`server.js` / `static.json`) and uses ATProto for auth. Age verification needs a **small stateful API** (new service or routes added alongside existing Loops `api/v1/*` if that stack is extended).

### Data model

```
age_verifications
  did              TEXT PRIMARY KEY   -- Bluesky DID from OAuth session
  status           ENUM pending|verified|failed|expired
  threshold        INT DEFAULT 21
  vendor           TEXT               -- veriff | yoti | persona
  vendor_session_id TEXT
  verified_at      TIMESTAMPTZ
  expires_at       TIMESTAMPTZ        -- optional re-verify policy (e.g. 12 mo)
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ
```

Store **no** document images, DOB, or full name on Flip — only vendor reference IDs and pass/fail.

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/v1/age-verification/status` | Bearer (ATProto access token) → resolve DID | Returns `{ required, status, verifiedAt, expiresAt }` |
| `POST` | `/api/v1/age-verification/session` | Bearer | Creates vendor session; returns `{ sessionUrl, sessionId, expiresAt }` |
| `POST` | `/api/v1/age-verification/webhook` | Vendor HMAC signature | Receives pass/fail; updates row by `vendor_session_id` |
| `POST` | `/api/v1/age-verification/dev-bypass` | Admin/dev only | **Non-production** — marks DID verified when `AGE_VERIFY_BYPASS` server flag set |

### Webhook handler (pseudocode)

```ts
// POST /api/v1/age-verification/webhook
verifyVendorSignature(req.headers, rawBody, WEBHOOK_SECRET);

const { sessionId, status, decision } = parseVendorPayload(req.body);
const row = await db.findByVendorSession(sessionId);

if (decision === 'approved' && meetsThreshold(decision, 21)) {
  await db.update(row.did, { status: 'verified', verified_at: now(), expires_at: now() + 1 year });
} else {
  await db.update(row.did, { status: 'failed' });
}

return 200;
```

### Session creation (pseudocode)

```ts
// POST /api/v1/age-verification/session
const did = await resolveDidFromAccessToken(req.headers.authorization);

const existing = await db.get(did);
if (existing?.status === 'verified' && !isExpired(existing)) {
  return { alreadyVerified: true };
}

const vendorSession = await veriff.createSession({
  vendorData: did,
  callback: 'flip://verify-age/callback',
});
await db.upsert({ did, status: 'pending', vendor_session_id: vendorSession.id });

return { sessionUrl: vendorSession.url, sessionId: vendorSession.id };
```

---

## Flip client integration points

### Feature flags (env)

| Variable | Default | Purpose |
|----------|---------|---------|
| `EXPO_PUBLIC_AGE_VERIFY_ENABLED` | `0` (off) | Master switch; when off, behavior is unchanged |
| `EXPO_PUBLIC_AGE_VERIFY_BYPASS` | unset | **`__DEV__` only** — skips gate locally; never ship enabled in production builds |

### `authStore` (`src/utils/authStore.ts`)

| Field / action | Purpose |
|----------------|---------|
| `ageVerified: boolean` | Client cache of server status (POC: local until API wired) |
| `setAgeVerified(value)` | Set after successful verification or status poll |
| `clearAgeVerification()` | Called on `logOut` |

Persist `ageVerified` in `partialize` only as a cache — **production must re-fetch `GET /status` on login** before trusting.

### Routing utility (`src/utils/ageVerification.ts`)

- `isAgeVerificationRequired(ageVerified)` — respects env flags.
- `getPostAuthRoute(ageVerified)` — returns `'/(tabs)'` or `'/verify-age'`.

### Post-auth redirects (after OAuth / password / biometric unlock)

Replace hard-coded `router.replace('/(tabs)')` with `router.replace(getPostAuthRoute(ageVerified))` in:

- `src/app/sign-in.tsx`
- `src/app/oauth-callback.tsx`

**Do not** insert age checks inside `loginWithOAuth`, `completeOAuthRedirect`, or OAuth callback URL handlers.

### Root layout guard (`src/app/_layout.tsx`)

- Register `Stack.Screen name="verify-age"`.
- `useAgeVerificationGate()` — when logged in, feature on, not verified, and not on OAuth routes → `router.replace('/verify-age')`.
- `initialRouteName` on native: `verify-age` when logged in + verification required.

### Verify screen (`src/app/verify-age.tsx`)

- Shown only when gate active.
- Copy: 21+ policy, link to privacy policy.
- Primary CTA: start verification (calls backend session → vendor SDK).
- Secondary: sign out (returns to Bluesky sign-in).
- Dev bypass button when `EXPO_PUBLIC_AGE_VERIFY_BYPASS` in `__DEV__`.

---

## Conflicts with current Flip

| Area | Current behavior | Impact |
|------|------------------|--------|
| **OAuth** | `oauth-callback.tsx` → `/(tabs)` on success | Must route to `/verify-age` when gate enabled; OAuth paths must stay exempt from gate |
| **Loops birthdate** | `api/v1/account/settings/birthdate` — self-reported | **Not** a substitute for ID verification; keep separate or deprecate for gating |
| **`hideAdultContent`** | User preference in `authStore` / content labels | Content filter only; unrelated to legal age gate |
| **Backend** | Heroku static + ATProto; Loops API for some settings | Need new webhook-capable API; static `server.js` cannot receive vendor POSTs as-is |
| **Expo Go** | OAuth limitations already documented | Vendor SDK likely requires **dev client / EAS build**, same as other native modules |
| **Biometric unlock** | `sign-in` unlock → tabs | Must use `getPostAuthRoute` after unlock |

---

## App Store / privacy checklist

- [ ] **Privacy policy** — disclose ID verification, vendor name, data collected (pass/fail only on Flip), retention, and user rights.
- [ ] **App Privacy (Apple)** — declare “Identifiers” / “Other Data” as collected for app functionality; note vendor processes government ID off-device.
- [ ] **Google Play Data safety** — same; ID documents processed by subprocessors.
- [ ] **Camera permission strings** — update `NSCameraUsageDescription` / Android rationale for ID capture (vendor SDK).
- [ ] **Age rating** — App Store / Play questionnaires; 21+ gate may still require 17+ store rating depending on content.
- [ ] **DPA / BAA** — sign vendor DPA; list vendor in subprocessor schedule.
- [ ] **CCPA / state privacy** — verification status is personal data; support access/delete (delete = revoke verification row, force re-verify).
- [ ] **No client-only bypass** — production builds must not honor `EXPO_PUBLIC_AGE_VERIFY_BYPASS`; server must not expose dev-bypass in prod.
- [ ] **Webhook security** — HMAC verification, idempotency, rate limits.
- [ ] **Re-verification policy** — document expiry (e.g. annual) in terms.

---

## Phased rollout

### Phase 0 — Spec + scaffold (current)

- [x] This document
- [x] `EXPO_PUBLIC_AGE_VERIFY_ENABLED=0` (default off)
- [x] Placeholder `/verify-age` screen + `authStore.ageVerified` + layout guard
- [ ] No vendor keys in repo

### Phase 1 — POC (sandbox)

- [ ] Veriff sandbox account + webhook to staging API
- [ ] `POST /session` + `GET /status` on staging
- [ ] Dev client build with Veriff RN SDK
- [ ] Internal testers only; `AGE_VERIFY_ENABLED=1` in dev builds

### Phase 2 — Beta

- [ ] Production API on `api.flip.app` (or dedicated service)
- [ ] Flip DID ↔ verification row on login sync
- [ ] Error states: failed, retry, support contact
- [ ] Analytics: funnel drop-off (no PII)

### Phase 3 — Production

- [ ] Enable flag for US users (geo or app config)
- [ ] Legal review + store listing updates
- [ ] Monitoring: webhook failures, vendor SLA
- [ ] Optional: re-verify on expiry; admin revoke

---

## 18 vs 21 (legal note)

US federal COPPA and many state laws reference **18** for adult content contracts; **21** applies to alcohol, cannabis, and some state-specific adult platforms. Flip’s product policy targets **21+** — configure vendor threshold to **21**, document the policy in terms, and have counsel confirm alignment with content type and distribution states. This doc is engineering guidance, not legal advice.

---

## Related files

| File | Role |
|------|------|
| `src/utils/ageVerification.ts` | Feature flags + routing helpers |
| `src/utils/authStore.ts` | `ageVerified` state |
| `src/app/verify-age.tsx` | Verification UI |
| `src/app/_layout.tsx` | Stack screen + cold-start gate |
| `src/app/sign-in.tsx` | Post-login route |
| `src/app/oauth-callback.tsx` | Post-OAuth route |
| `docs/OAUTH_HOSTING.md` | OAuth metadata (unchanged by age verify) |
