import metadata from '../../assets/oauth-client-metadata.json';

/**
 * Bluesky fetches client metadata from the `client_id` URL during PAR/token exchange.
 * flip.app (Cloudflare) still returns SPA HTML for /oauth-client-metadata.json; Heroku
 * deploy target app name was wrong (see deploy-web.yml). jsDelivr serves application/json.
 *
 * When flip.app serves JSON, set client_id in assets/oauth-client-metadata.json to
 * https://flip.app/oauth-client-metadata.json and drop the override below.
 */
export const OAUTH_CLIENT_METADATA_URL =
    'https://cdn.jsdelivr.net/gh/sjvr87/Flip@main/assets/oauth-client-metadata.json';

export function getOAuthClientMetadata() {
    return {
        ...metadata,
        client_id: OAUTH_CLIENT_METADATA_URL,
    };
}
