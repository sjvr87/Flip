import * as Linking from 'expo-linking';

const OAUTH_CALLBACK_PATHS = new Set(['/oauth/callback', '/oauth-callback']);

/** ATProto native redirect: net.jsdelivr.cdn:/oauth/callback?code=…&state=… */
export function isOAuthCallbackUrl(url: string): boolean {
    if (!url) return false;
    try {
        const normalized = url.includes(':/') ? url : `flip:${url}`;
        const parsed = new URL(normalized);
        if (OAUTH_CALLBACK_PATHS.has(parsed.pathname)) {
            return true;
        }
        if (parsed.protocol === 'net.jsdelivr.cdn:' && parsed.pathname === '/oauth/callback') {
            return true;
        }
        if (parsed.protocol === 'app.flip:' && parsed.pathname === '/oauth/callback') {
            return true;
        }
    } catch {
        const bare = url.replace(/^[a-z0-9.-]+:\/*/i, '');
        if (bare === 'oauth/callback' || bare.startsWith('oauth/callback?')) {
            return true;
        }
    }
    return false;
}

export function searchParamsFromCallbackUrl(url: string): URLSearchParams {
    const params = new URLSearchParams();
    try {
        const normalized = url.includes(':/') ? url : `flip:${url}`;
        const parsed = new URL(normalized);
        parsed.searchParams.forEach((value, key) => {
            params.set(key, value);
        });
        if (params.size > 0) {
            return params;
        }
    } catch {
        // fall through to Linking.parse
    }

    const { queryParams } = Linking.parse(url);
    if (queryParams) {
        for (const [key, value] of Object.entries(queryParams)) {
            if (typeof value === 'string') {
                params.set(key, value);
            } else if (Array.isArray(value) && typeof value[0] === 'string') {
                params.set(key, value[0]);
            }
        }
    }
    return params;
}

export function searchParamsFromRouteParams(
    params: Record<string, string | string[] | undefined>,
): URLSearchParams {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') {
            searchParams.set(key, value);
        } else if (Array.isArray(value) && typeof value[0] === 'string') {
            searchParams.set(key, value[0]);
        }
    }
    return searchParams;
}

export function hasOAuthCallbackParams(params: URLSearchParams): boolean {
    return params.has('code') || params.has('state') || params.has('error');
}

/** True when a deep-link path or URL includes OAuth callback query (code, state, or error). */
export function hasOAuthCallbackQueryInPath(path: string): boolean {
    if (!path) return false;
    try {
        const normalized = path.includes(':/') ? path : `flip:${path}`;
        return hasOAuthCallbackParams(searchParamsFromCallbackUrl(normalized));
    } catch {
        const queryStart = path.indexOf('?');
        if (queryStart < 0) return false;
        return hasOAuthCallbackParams(new URLSearchParams(path.slice(queryStart + 1)));
    }
}

/** Resolve callback query from expo-router params and/or the system deep link URL. */
export async function resolveOAuthCallbackSearchParams(
    routeParams: Record<string, string | string[] | undefined>,
    linkingUrl?: string | null,
): Promise<{ searchParams: URLSearchParams; callbackUrl: string | null }> {
    let callbackUrl: string | null = null;

    if (linkingUrl && isOAuthCallbackUrl(linkingUrl)) {
        callbackUrl = linkingUrl;
    }

    if (!callbackUrl) {
        const initial = await Linking.getInitialURL();
        if (initial && isOAuthCallbackUrl(initial)) {
            callbackUrl = initial;
        }
    }

    const fromRoute = searchParamsFromRouteParams(routeParams);
    if (hasOAuthCallbackParams(fromRoute)) {
        return { searchParams: fromRoute, callbackUrl };
    }

    if (callbackUrl) {
        return { searchParams: searchParamsFromCallbackUrl(callbackUrl), callbackUrl };
    }

    return { searchParams: fromRoute, callbackUrl: null };
}
