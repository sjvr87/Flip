import metadata from '../../assets/oauth-client-metadata.json';

/** Bluesky fetches this URL during PAR/token exchange; hostname must be flip.app for app.flip: redirect. */
export const OAUTH_CLIENT_METADATA_URL = 'https://flip.app/oauth-client-metadata.json';

export function getOAuthClientMetadata() {
    return {
        ...metadata,
        client_id: OAUTH_CLIENT_METADATA_URL,
    };
}

export type OAuthMetadataPreflightError =
    | 'unreachable'
    | 'not_json'
    | 'html_spa'
    | 'client_id_mismatch'
    | 'redirect_uri_mismatch';

export type OAuthMetadataPreflightResult =
    | { ok: true }
    | { ok: false; reason: OAuthMetadataPreflightError; detail: string };

/** Reverse FQDN custom-scheme prefix required by ATProto OAuth (e.g. flip.app → app.flip:). */
function redirectSchemeForClientId(clientIdUrl: string): string {
    const host = new URL(clientIdUrl).hostname;
    return `${host.split('.').reverse().join('.')}:`;
}

/**
 * Verify hosted client metadata before opening the OAuth browser.
 * flip.app must return application/json — SPA HTML breaks Bluesky sign-in.
 */
export async function preflightOAuthClientMetadata(): Promise<OAuthMetadataPreflightResult> {
    const clientId = OAUTH_CLIENT_METADATA_URL;
    let response: Response;
    try {
        response = await fetch(clientId, { method: 'GET', redirect: 'follow' });
    } catch (error) {
        const detail =
            error instanceof Error ? error.message : 'Network error fetching client metadata';
        return { ok: false, reason: 'unreachable', detail };
    }

    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();

    if (!response.ok) {
        return {
            ok: false,
            reason: 'unreachable',
            detail: `HTTP ${response.status} from ${clientId}`,
        };
    }

    if (contentType.includes('text/html') || body.trimStart().startsWith('<!')) {
        return {
            ok: false,
            reason: 'html_spa',
            detail: `${clientId} returned HTML (SPA shell) instead of JSON — deploy flip.app OAuth hosting`,
        };
    }

    if (!contentType.includes('application/json')) {
        return {
            ok: false,
            reason: 'not_json',
            detail: `Expected application/json, got ${contentType || 'unknown'}`,
        };
    }

    let hosted: Record<string, unknown>;
    try {
        hosted = JSON.parse(body.replace(/^\uFEFF/, '')) as Record<string, unknown>;
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'Invalid JSON';
        return { ok: false, reason: 'not_json', detail };
    }

    if (hosted.client_id !== clientId) {
        return {
            ok: false,
            reason: 'client_id_mismatch',
            detail: `Hosted client_id is ${String(hosted.client_id)}; expected ${clientId}`,
        };
    }

    const expectedScheme = redirectSchemeForClientId(clientId);
    const redirectUris = hosted.redirect_uris;
    if (
        !Array.isArray(redirectUris) ||
        !redirectUris.every((uri) => typeof uri === 'string' && uri.startsWith(expectedScheme))
    ) {
        return {
            ok: false,
            reason: 'redirect_uri_mismatch',
            detail: `redirect_uris must use scheme ${expectedScheme} (got ${JSON.stringify(redirectUris)})`,
        };
    }

    return { ok: true };
}

export function oauthMetadataPreflightMessage(result: Extract<OAuthMetadataPreflightResult, { ok: false }>): string {
    switch (result.reason) {
        case 'html_spa':
            return `Flip sign-in config is not deployed yet (${result.detail}).`;
        case 'unreachable':
            return `Cannot reach Flip sign-in config at flip.app (${result.detail}).`;
        case 'not_json':
            return `Flip sign-in config returned invalid data (${result.detail}).`;
        case 'client_id_mismatch':
            return `Flip sign-in config has a mismatched client_id (${result.detail}).`;
        case 'redirect_uri_mismatch':
            return `Flip sign-in config has invalid redirect URIs (${result.detail}).`;
    }
}
