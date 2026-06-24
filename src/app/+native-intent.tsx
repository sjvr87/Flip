/**
 * Filter Metro / dev-client launch URLs so Expo Router does not treat
 * exp://LAN:8081 (or flip://LAN:8081) as an in-app route.
 *
 * expo-router's extractPathFromURL has a TODO for dev-client URLs; without
 * this hook, exp://192.168.x.x:8081 becomes route "192.168.x.x:8081" → Unmatched Route.
 *
 * ATProto native OAuth uses reverse-domain custom schemes, e.g.
 * net.jsdelivr.cdn:/oauth/callback — map to the expo-router screen at /oauth/callback.
 *
 * Stale flip://explore (and other tab) deep links from prior sessions are rewritten
 * on cold start so NavigationContainer does not mount an invalid initial route.
 */

import { hasOAuthCallbackQueryInPath } from '@/atproto/oauthCallbackUrl';

function ensureQueueMicrotaskForLinking(): void {
    try {
        require('../bootstrap/ensureQueueMicrotask').ensureQueueMicrotask();
    } catch {
        // tests / web
    }
}

const OAUTH_CALLBACK_PATHS = new Set(['/oauth/callback', '/oauth-callback']);

/** Tab names that flip:// may use as hostname (flip://explore → path "explore"). */
const TAB_DEEP_LINK_NAMES = new Set([
    'explore',
    'create',
    'notifications',
    'profile',
    'index',
    'home',
]);

const TAB_ROUTE_BY_NAME: Record<string, string> = {
    explore: '/explore',
    create: '/create',
    notifications: '/notifications',
    profile: '/profile',
    index: '/',
    home: '/',
};

function querySuffix(path: string): string {
    const idx = path.indexOf('?');
    return idx >= 0 ? path.slice(idx) : '';
}

/** Strip scheme and leading slashes; keep query string on the returned bare segment. */
function bareDeepLinkSegment(path: string): string {
    const withoutScheme = path.replace(/^[a-z0-9.-]+:\/*/i, '');
    return withoutScheme.replace(/^\//, '');
}

function tabNameFromPath(path: string): string | null {
    const bare = bareDeepLinkSegment(path);
    const routePart = bare.split('?')[0];

    const firstSegment = routePart.replace(/^\//, '').split('/').filter(Boolean)[0];
    if (firstSegment && TAB_DEEP_LINK_NAMES.has(firstSegment)) {
        return firstSegment;
    }

    const tabRouteMatch = routePart.match(/(?:\(tabs\)\/|^tabs\/)([^/?]+)/);
    if (tabRouteMatch?.[1] && TAB_DEEP_LINK_NAMES.has(tabRouteMatch[1])) {
        return tabRouteMatch[1];
    }

    try {
        const url = new URL(path.includes(':/') ? path : `flip://${bare}`);
        if (url.protocol === 'flip:' || url.protocol === 'app.flip:') {
            const host = url.hostname;
            if (TAB_DEEP_LINK_NAMES.has(host)) {
                return host;
            }
            const pathSegment = url.pathname.replace(/^\//, '').split('/')[0];
            if (pathSegment && TAB_DEEP_LINK_NAMES.has(pathSegment)) {
                return pathSegment;
            }
        }
    } catch {
        // fall through
    }

    return null;
}

function isStaleAppDeepLink(path: string): boolean {
    return tabNameFromPath(path) !== null;
}

function mapTabDeepLink(path: string): string | null {
    const tab = tabNameFromPath(path);
    if (!tab) return null;
    const route = TAB_ROUTE_BY_NAME[tab];
    return `${route}${querySuffix(path)}`;
}

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
        ensureQueueMicrotaskForLinking();

        if (!path || isMetroOrDevClientUrl(path)) {
            return null;
        }

        if (isOAuthCallbackUrl(path)) {
            // Cold start can replay a bare callback intent (no ?code=&state=) and trigger a false error.
            if (initial && !hasOAuthCallbackQueryInPath(path)) {
                return null;
            }
            return oauthCallbackRoute(path);
        }

        if (isStaleAppDeepLink(path)) {
            if (initial) {
                if (__DEV__) {
                    console.log('[linking] ignore stale tab deep link on cold start:', path);
                }
                return null;
            }
            return mapTabDeepLink(path);
        }

        return path;
    } catch {
        return null;
    }
}
