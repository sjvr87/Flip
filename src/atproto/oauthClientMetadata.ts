import metadata from '../../assets/oauth-client-metadata.json';

/**
 * Bluesky fetches client metadata from the `client_id` URL during PAR/token exchange.
 * flip.app currently serves the SPA shell (HTML) for /oauth-client-metadata.json.
 *
 * Host metadata on jsDelivr (application/json) until flip.app Heroku deploy is live.
 * After merging to main, switch HOSTED_METADATA_URL to @main jsDelivr URL or flip.app.
 */
const HOSTED_METADATA_URL =
    'https://cdn.jsdelivr.net/gh/sjvr87/Flip@bbdb96e/assets/oauth-client-metadata.json';

const HOSTED_CLIENT_URI =
    'https://cdn.jsdelivr.net/gh/sjvr87/Flip@perf/feed-swipe-smoothness/';

export function getOAuthClientMetadata() {
    return {
        ...metadata,
        client_id: HOSTED_METADATA_URL,
        // Must share origin with client_id (Bluesky rejects flip.app vs jsDelivr).
        client_uri: HOSTED_CLIENT_URI,
    };
}