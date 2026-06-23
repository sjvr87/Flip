import metadata from '../../assets/oauth-client-metadata.json';

/**
 * Bluesky fetches client metadata from the `client_id` URL during PAR/token exchange.
 * flip.app currently serves the SPA shell (HTML) for /oauth-client-metadata.json.
 *
 * Host metadata on jsDelivr (application/json) until flip.app Heroku deploy is live.
 * jsDelivr cannot resolve Git branch names containing "/" (e.g. perf/feed-swipe-smoothness → 502).
 * Use a git tag (not perf/branch) so client_id and client_uri stay self-consistent on jsDelivr.
 */
const JSDELIVR_REF = 'oauth-metadata';

const HOSTED_METADATA_URL = `https://cdn.jsdelivr.net/gh/sjvr87/Flip@${JSDELIVR_REF}/assets/oauth-client-metadata.json`;

const HOSTED_CLIENT_URI = `https://cdn.jsdelivr.net/gh/sjvr87/Flip@${JSDELIVR_REF}/`;

export function getOAuthClientMetadata() {
    return {
        ...metadata,
        client_id: HOSTED_METADATA_URL,
        // Must share origin with client_id (Bluesky rejects flip.app vs jsDelivr).
        client_uri: HOSTED_CLIENT_URI,
    };
}
