/**
 * Staging PDS constants for Phase 0 Flip-native signup spike.
 *
 * These are used only in __DEV__ builds and for manual testing against
 * the invite-only staging PDS. Do NOT reference these in production paths.
 */

/** Hostname of the staging PDS (no protocol). */
export const STAGING_PDS_HOST = 'staging.flip.app';

/** Full URL of the staging PDS service endpoint. */
export const STAGING_PDS_URL = `https://${STAGING_PDS_HOST}`;

/** Handle suffix for accounts created on the staging PDS. */
export const STAGING_HANDLE_SUFFIX = '.staging.flip.app';
