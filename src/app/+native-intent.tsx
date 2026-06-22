/**
 * Filter Metro / dev-client launch URLs so Expo Router does not treat
 * exp://LAN:8081 (or flip://LAN:8081) as an in-app route.
 *
 * expo-router's extractPathFromURL has a TODO for dev-client URLs; without
 * this hook, exp://192.168.x.x:8081 becomes route "192.168.x.x:8081" → Unmatched Route.
 */

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
        if (
            url.protocol === 'flip:' &&
            /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) &&
            url.port
        ) {
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
        return path;
    } catch {
        return initial ? '/' : null;
    }
}
