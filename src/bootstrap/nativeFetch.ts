import { Platform } from 'react-native';

/**
 * React Native networking fetch, captured before Expo 56 winter runtime may
 * replace globalThis.fetch with expo/fetch (breaks @atproto DID resolution).
 * @see https://github.com/expo/expo/issues/45909
 */
let rnFetch: typeof fetch | null = null;
let defaultFetch: typeof fetch | null = null;
let installed = false;

function captureBootstrapFetches(): void {
    if (Platform.OS === 'web') return;
    if (!defaultFetch && typeof globalThis.fetch === 'function') {
        defaultFetch = globalThis.fetch.bind(globalThis);
    }
    if (!rnFetch) {
        try {
            const mod = require('react-native/Libraries/Network/fetch') as {
                fetch?: typeof fetch;
            };
            if (typeof mod.fetch === 'function') {
                rnFetch = mod.fetch;
            }
        } catch {
            // RN networking not ready yet; resolveNativeFetch() retries on first use.
        }
    }
}

captureBootstrapFetches();

function resolveNativeFetch(): typeof fetch {
    if (Platform.OS === 'web') {
        return fetch.bind(globalThis);
    }
    if (!rnFetch) {
        const mod = require('react-native/Libraries/Network/fetch') as { fetch: typeof fetch };
        if (typeof mod.fetch !== 'function') {
            throw new TypeError('React Native fetch is not available');
        }
        rnFetch = mod.fetch;
    }
    return rnFetch;
}

/** Expo / winter global fetch — use for HTTPS metadata and other non-ATProto requests. */
export function getDefaultFetch(): typeof fetch {
    if (Platform.OS === 'web') {
        return fetch.bind(globalThis);
    }
    if (!defaultFetch && typeof globalThis.fetch === 'function') {
        defaultFetch = globalThis.fetch.bind(globalThis);
    }
    if (!defaultFetch) {
        throw new TypeError('Default fetch is not available');
    }
    return defaultFetch;
}

/** RN fetch for ATProto identity / PLC / OAuth resolver paths (expo/fetch breaks these). */
export const nativeFetch: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    resolveNativeFetch()(input, init)) as typeof fetch;

/**
 * After OAuth client init, code paths that read globalThis.fetch (identity resolver)
 * must see RN fetch. Call only once OAuth is about to run — not at app bootstrap
 * (breaks metadata preflight and other HTTPS fetches).
 */
export function installNativeFetchGlobal(): void {
    if (installed || Platform.OS === 'web') return;
    installed = true;
    if (!defaultFetch && typeof globalThis.fetch === 'function') {
        defaultFetch = globalThis.fetch.bind(globalThis);
    }
    globalThis.fetch = nativeFetch;
    if (__DEV__) {
        console.log('[fetch] RN fetch active for ATProto OAuth (metadata uses default fetch)');
    }
}
