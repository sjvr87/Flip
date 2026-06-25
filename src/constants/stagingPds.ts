/**
 * Flip Phase 0 — staging PDS constants.
 *
 * These values wire the dev build to the invite-only staging PDS so that
 * test accounts created via `scripts/staging-pds/create-test-account.*` can
 * sign in through the existing hidden "Server (optional)" field on the sign-in
 * screen without any auth rewrite.
 *
 * ⚠️  DO NOT import these in production code paths.
 *     Gate all usages with `__DEV__` or an explicit env-var check.
 */

/** Hostname of the invite-only staging PDS (no protocol, no trailing slash). */
export const STAGING_PDS_HOST = process.env.EXPO_PUBLIC_FLIP_STAGING_PDS_HOST ?? '';

/** Full URL origin for direct AT Protocol calls to the staging PDS. */
export const STAGING_PDS_URL = `https://${STAGING_PDS_HOST}`;

/**
 * Handle suffix assigned to accounts created on the staging PDS.
 * e.g. `alice` → `alice.staging.flip.app`
 */
export const STAGING_HANDLE_SUFFIX = `.${STAGING_PDS_HOST}`;
