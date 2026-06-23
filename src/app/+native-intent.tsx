/**
 * Filter Metro / dev-client launch URLs so Expo Router does not treat
 * exp://LAN:8081 (or flip://LAN:8081) as an in-app route.
 *
 * expo-router's extractPathFromURL has a TODO for dev-client URLs; without
 * this hook, exp://192.168.x.x:8081 becomes route "192.168.x.x:8081" → Unmatched Route.
 *
 * ATProto native OAuth uses reverse-domain custom schemes, e.g.
 * net.jsdelivr.cdn:/oauth/callback — map to the expo-router screen at /oauth/callback.
 */

const OAUTH_CALLBACK_PATHS = new Set(['/oauth/callback', '/oauth-callback']);

function isOAuthCallbackUrl(path: string): boolean {
    try {
        const url = new URL(path.includes(':/') ? path : `flip:${path}`);
        if (OAUTH_CALLBACK_PATHS.has(url.pathname)) {
            return true;
        }
        if (url.protocol === 'net.jsdelivr.cdn:' && url.pathname === '/oauth/callback') {
            return true;
        }
        if (url.protocol === 'app.flip:' && url.pathname === '/oauth/callback') {
            return true;
        }
    } catch {
        const bare = path.replace(/^[a-z0-9.-]+:\/*/i, '');
        if (bare === 'oauth/callback' || bare.startsWith('oauth/callback?')) {
            return true;
        }
    }
    return false;
}

function oauthCallbackRoute(path: string): string {
    try {
        const url = new URL(path.includes(':/') ? path : `flip:${path}`);
        return `/oauth/callback${url.search}`;
    } catch {
        const query = path.includes('?') ? path.slice(path.indexOf('?')) : '';
        return `/oauth/callback${query}`;
    }
}

function isMetroOrDevClientUrl(path: string): boolean {
    if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(path)) {
        return true;
    }

    try {
        const url = new URL(path, 'flip://app');

        if (url.hostname === 'expo-development-client') {
            return true;
        }

        if (/^exp(s)?:$/i.test(url.protocol.replace(':', ''))) {
            return true;
        }

        // flip://192.168.x.x:8081 — host:port mistaken for a route path
        if (url.protocol === 'flip:' && /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) && url.port) {
            return true;
        }

        const inner = url.searchParams.get('url');
        if (inner && /^exp(s)?:\/\//i.test(inner)) {
            return true;
        }
    } catch {
        if (/^exp(s)?:\/\//i.test(path) || path.includes('expo-development-client')) {
            return true;
        }
    }

    return false;
}

export function redirectSystemPath({
    path,
    initial,
}: {
    path: string | null;
    initial: boolean;
}): string | null {
    try {
        if (!path || isMetroOrDevClientUrl(path)) {
            return initial ? '/' : null;
        }
        if (isOAuthCallbackUrl(path)) {
            return oauthCallbackRoute(path);
        }
        return path;
    } catch {
        return initial ? '/' : null;
    }
}
