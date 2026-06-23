import metadata from '../../assets/oauth-client-metadata.json';

/**
 * Bluesky OAuth: redirect_uris scheme must be the client_id FQDN in reverse order.
 * flip.app → app.flip:/oauth/callback (not jsDelivr — cdn.jsdelivr.net → net.jsdelivr.cdn:).
 *
 * Hosted metadata must return application/json at flip.app (see docs/OAUTH_HOSTING.md).
 */
const FLIP_APP_ORIGIN = 'https://flip.app';
const HOSTED_METADATA_URL = `${FLIP_APP_ORIGIN}/oauth-client-metadata.json`;

export function getOAuthClientMetadata() {
    return {
        ...metadata,
        client_id: HOSTED_METADATA_URL,
        client_uri: `${FLIP_APP_ORIGIN}/`,
    };
}
