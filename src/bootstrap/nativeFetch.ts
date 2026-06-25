import { installAbortSignalPolyfills } from './abortSignalPolyfill';
import { Platform } from 'react-native';

/**
 * React Native networking fetch, captured before Expo 56 winter runtime may
 * replace globalThis.fetch with expo/fetch (breaks @atproto DID resolution).
 * @see https://github.com/expo/expo/issues/45909
 *
 * RN 0.85 installs fetch lazily via setUpXHR. Direct require of
 * Libraries/Network/fetch.js snapshots `global.fetch` at module load and can
 * capture undefined during lazy-getter circular init — materialize global fetch instead.
 */
let rnFetch: typeof fetch | null = null;
let defaultFetch: typeof fetch | null = null;
let installed = false;

type GlobalWithFetchBackup = typeof globalThis & { originalFetch?: typeof fetch };

function useReactNativeFetchGlobally(): boolean {
    return (
        process.env.EXPO_PUBLIC_USE_RN_FETCH === '1' ||
        process.env.EXPO_PUBLIC_USE_RN_FETCH === 'true'
    );
}

function ensureReactNativeFetchPolyfill(): void {
    try {
        require('react-native/Libraries/Core/InitializeCore');
    } catch {
        // Already initialized or unavailable in test environments.
    }
    installAbortSignalPolyfills();
}

/** Touch RN's lazy fetch getter so globalThis.fetch is a real function. */
function readMaterializedFetch(): typeof fetch | null {
    ensureReactNativeFetchPolyfill();
    if (typeof globalThis.fetch === 'function') {
        installAbortSignalPolyfills();
        return globalThis.fetch.bind(globalThis);
    }
    const original = (globalThis as GlobalWithFetchBackup).originalFetch;
    if (typeof original === 'function') {
        installAbortSignalPolyfills();
        return original.bind(globalThis);
    }
    return null;
}

function captureBootstrapFetches(): void {
    if (Platform.OS === 'web') return;
    if (!defaultFetch) {
        defaultFetch = readMaterializedFetch();
    }
    if (!rnFetch) {
        rnFetch = defaultFetch;
    }
}

captureBootstrapFetches();

function resolveNativeFetch(): typeof fetch {
    if (Platform.OS === 'web') {
        return fetch.bind(globalThis);
    }
    if (!rnFetch) {
        rnFetch = readMaterializedFetch();
    }
    if (!rnFetch) {
        throw new TypeError('React Native fetch is not available');
    }
    return rnFetch;
}

/** Expo / winter global fetch — use for HTTPS metadata and other non-ATProto requests. */
export function getDefaultFetch(): typeof fetch {
    if (Platform.OS === 'web') {
        return fetch.bind(globalThis);
    }
    if (useReactNativeFetchGlobally()) {
        if (!defaultFetch) {
            defaultFetch = resolveNativeFetch();
        }
        return defaultFetch;
    }
    if (defaultFetch) {
        return defaultFetch;
    }
    if (typeof globalThis.fetch === 'function' && globalThis.fetch !== nativeFetch) {
        defaultFetch = globalThis.fetch.bind(globalThis);
        return defaultFetch;
    }
    try {
        const expoFetch = require('expo/fetch').fetch as typeof fetch;
        if (typeof expoFetch === 'function') {
            defaultFetch = expoFetch.bind(globalThis);
            return defaultFetch;
        }
    } catch {
        // expo/fetch unavailable
    }
    defaultFetch = resolveNativeFetch();
    return defaultFetch;
}

/** RN fetch for ATProto identity / PLC / OAuth resolver paths (expo/fetch breaks these). */
export const nativeFetch: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    resolveNativeFetch()(input, init)) as typeof fetch;

function requestUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
}

/**
 * OAuthClient needs both fetch implementations on Android:
 * - default (expo) fetch for RFC 8414 / 9728 well-known metadata and client_id JSON
 * - RN fetch for identity (PLC/xrpc), PAR, token exchange, and DPoP nonce headers
 */
function needsNativeFetch(url: string): boolean {
    try {
        const { hostname, pathname } = new URL(url);
        if (pathname.startsWith('/.well-known/oauth-')) {
            return false;
        }
        if (hostname === 'cdn.jsdelivr.net') {
            return false;
        }
        return true;
    } catch {
        return true;
    }
}

export const oauthFetch: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (needsNativeFetch(url)) {
        return nativeFetch(input, init);
    }
    return getDefaultFetch()(input, init);
}) as typeof fetch;

/**
 * Temporarily point globalThis.fetch at RN fetch for code paths that ignore the
 * OAuthClient `fetch` option (identity resolver). Scoped — does not break expo-router
 * linking, which relies on expo/fetch remaining on global during navigation init.
 */
export function runWithNativeFetchGlobal<T>(fn: () => T): T;
export function runWithNativeFetchGlobal<T>(fn: () => Promise<T>): Promise<T>;
export function runWithNativeFetchGlobal<T>(fn: () => T | Promise<T>): T | Promise<T> {
    const previous = globalThis.fetch;
    globalThis.fetch = nativeFetch;
    try {
        const result = fn();
        if (result instanceof Promise) {
            return result.finally(() => {
                globalThis.fetch = previous;
            }) as Promise<T>;
        }
        globalThis.fetch = previous;
        return result;
    } catch (error) {
        globalThis.fetch = previous;
        throw error;
    }
}

/**
 * @deprecated Prefer runWithNativeFetchGlobal — permanent global override breaks
 * expo-router NavigationContainer on Android after OAuth session restore.
 */
export function installNativeFetchGlobal(): void {
    if (installed || Platform.OS === 'web') return;
    installed = true;
    if (!defaultFetch) {
        defaultFetch = readMaterializedFetch();
    }
    if (!rnFetch) {
        rnFetch = defaultFetch ?? readMaterializedFetch();
    }
    globalThis.fetch = nativeFetch;
    if (__DEV__) {
        console.log('[fetch] RN fetch active for ATProto OAuth (metadata uses default fetch)');
    }
}
