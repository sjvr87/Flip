import * as WebBrowser from 'expo-web-browser';
import { openAuthSessionAsync } from 'expo-web-browser';
import { OAuthClient, type OAuthSession } from '@atproto/oauth-client';
const NativeModule = require('@atproto/oauth-client-expo/dist/ExpoAtprotoOAuthClientModule').default;
const { ExpoKey } = require('@atproto/oauth-client-expo/dist/utils/expo-key');

import { installNativeFetchGlobal, nativeFetch, oauthFetch } from '@/bootstrap/nativeFetch';
import { getOAuthClientMetadata } from './oauthClientMetadata';

import {
    AuthorizationServerMetadataCache,
    DidCache,
    DpopNonceCache,
    HandleCache,
    ProtectedResourceMetadataCache,
    SessionStore,
    StateStore,
    clearOAuthTransientSecureStore,
} from './oauthStores.native';

// JSI polyfills (DisposableStack, URL) required by @atproto/oauth-client-expo.
require('@atproto/oauth-client-expo/dist/polyfill.native');

WebBrowser.maybeCompleteAuthSession();

const CUSTOM_URI_SCHEME_REGEX = /^(?:[^.]+(?:\.[^.]+)+):\/(?:[^/].*)?$/;
const isCustomUriScheme = (uri: string) => CUSTOM_URI_SCHEME_REGEX.test(uri);

const OAUTH_SIGNIN_WAIT_MS = 60_000;

/** Bluesky PAR returns DPoP-Nonce even on invalid requests — seed cache before authorize. */
function readDpopNonceHeader(headers: Headers): string | null {
    return headers.get('DPoP-Nonce') ?? headers.get('dpop-nonce');
}

async function probeAuthorizationServerDpopNonce(parEndpoint: string): Promise<string | null> {
    const response = await nativeFetch(parEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: 'dpop-nonce-probe' }).toString(),
    });
    return readDpopNonceHeader(response.headers);
}

type OAuthResolverLike = {
    resolve: (
        input: string,
        options?: { signal?: AbortSignal },
    ) => Promise<{ metadata: { pushed_authorization_request_endpoint?: string } }>;
};

const runtimeImplementation = {
    createKey: async (algs: Parameters<typeof ExpoKey.generate>[0]) => ExpoKey.generate(algs),
    digest: async (bytes: Uint8Array, { name }: { name: string }) =>
        NativeModule.digest(bytes, name),
    getRandomValues: async (length: number) => NativeModule.getRandomValues(length),
};

/** Bluesky Expo OAuth client without MMKV (avoids JSI / remote-debug failures). */
class FlipExpoOAuthClient extends OAuthClient {
    #disposables: DisposableStack;
    #dpopNonceCache: DpopNonceCache;
    #stateStore: StateStore;

    constructor(options: { handleResolver: string; clientMetadata }) {
        const stack = new DisposableStack();
        const dpopNonceCache = stack.use(new DpopNonceCache());
        const stateStore = stack.use(new StateStore());
        super({
            ...options,
            fetch: oauthFetch,
            responseMode: 'query',
            keyset: undefined,
            runtimeImplementation,
            sessionStore: stack.use(new SessionStore()),
            stateStore,
            didCache: stack.use(new DidCache()),
            handleCache: stack.use(new HandleCache()),
            dpopNonceCache,
            authorizationServerMetadataCache: stack.use(new AuthorizationServerMetadataCache()),
            protectedResourceMetadataCache: stack.use(new ProtectedResourceMetadataCache()),
        });
        this.#disposables = stack.move();
        this.#dpopNonceCache = dpopNonceCache;
        this.#stateStore = stateStore;
    }

    async handleCallback() {
        return null;
    }

    /** Await SecureStore writes (state/PKCE) before browser redirect or token exchange. */
    async readyStores(): Promise<void> {
        await this.#stateStore.ready();
    }

    /** Drop stale PKCE/state and DPoP nonces before a new sign-in attempt. */
    async clearTransientStores(): Promise<void> {
        await this.readyStores();
        await Promise.all([
            this.#dpopNonceCache.clearPersisted(),
            this.#stateStore.clearPersisted(),
        ]);
    }

    /**
     * Bluesky requires a DPoP nonce on PAR; RN fetch often skips the library's single
     * in-flight retry, so obtain a nonce with a plain probe POST before authorize().
     */
    async preflightDpopNonce(input: Parameters<OAuthClient['authorize']>[0]): Promise<void> {
        const resolver = (this as unknown as { oauthResolver?: OAuthResolverLike }).oauthResolver;
        if (!resolver) return;

        let parEndpoint: string | undefined;
        try {
            const { metadata } = await resolver.resolve(String(input), {});
            parEndpoint = metadata.pushed_authorization_request_endpoint;
        } catch (error) {
            if (__DEV__) {
                console.warn('[auth] DPoP preflight metadata resolve failed:', error);
            }
            return;
        }
        if (!parEndpoint) return;

        try {
            const nonce = await probeAuthorizationServerDpopNonce(parEndpoint);
            if (!nonce) {
                if (__DEV__) {
                    console.warn('[auth] DPoP preflight: PAR probe returned no DPoP-Nonce header');
                }
                return;
            }
            const origin = new URL(parEndpoint).origin;
            this.#dpopNonceCache.set(origin, nonce);
            if (__DEV__) {
                console.log('[auth] DPoP nonce pre-warmed for', origin);
            }
        } catch (error) {
            if (__DEV__) {
                console.warn('[auth] DPoP nonce preflight probe failed:', error);
            }
        }
    }

    async signIn(
        input: Parameters<OAuthClient['authorize']>[0],
        options?: Parameters<OAuthClient['authorize']>[1],
    ) {
        const redirectUri =
            options?.redirect_uri ??
            this.clientMetadata.redirect_uris.find((uri) => isCustomUriScheme(uri));
        if (!redirectUri) {
            throw new TypeError('A redirect URI with a custom scheme is required for Expo OAuth.');
        }

        // Wipe in-memory + SecureStore nonces before PAR (authorize); stale nonce → handshake error.
        await this.clearTransientStores();
        await this.preflightDpopNonce(input);

        const url = await this.authorize(input, {
            ...options,
            redirect_uri: redirectUri,
            display: options?.display ?? 'touch',
        });

        // PAR + state writes go to SecureStore; flush before Chrome Custom Tab backgrounds the app.
        await this.readyStores();

        const result = await openAuthSessionAsync(url.toString(), redirectUri, {
            dismissButtonStyle: 'cancel',
            preferEphemeralSession: false,
        });

        if (result.type === 'success') {
            oauthCustomTabExchangeAttempted = true;
            const callbackUrl = new URL(result.url);
            const params =
                this.responseMode === 'fragment'
                    ? new URLSearchParams(callbackUrl.hash.slice(1))
                    : callbackUrl.searchParams;
            return exchangeOAuthCallback(this, params, redirectUri);
        }

        throw new Error(`Authentication cancelled: ${result.type}`);
    }

    async [Symbol.asyncDispose]() {
        this.#disposables.dispose();
    }
}

export type ExpoOAuthClient = FlipExpoOAuthClient;

function getCustomRedirectUri(client: FlipExpoOAuthClient): string {
    const redirectUri = client.clientMetadata.redirect_uris.find((uri) => isCustomUriScheme(uri));
    if (!redirectUri) {
        throw new TypeError('A redirect URI with a custom scheme is required for Expo OAuth.');
    }
    return redirectUri;
}

let client: FlipExpoOAuthClient | null = null;
let initError: Error | null = null;
let oauthSignInFlight: Promise<OAuthSession> | null = null;
let oauthExchangeFlight: Promise<OAuthSession> | null = null;
/** Set when Custom Tab returned a callback URL and signIn attempted token exchange. */
let oauthCustomTabExchangeAttempted = false;
/** Outcome of the most recent runOAuthSignIn (cleared on resetOAuthClient). */
let oauthSignInOutcome: 'success' | 'failed' | null = null;
/** Serialize resets — concurrent clear/dispose during PAR causes use_dpop_nonce failures. */
let resetOAuthClientLock: Promise<void> = Promise.resolve();

export function wasOAuthCustomTabExchangeAttempted(): boolean {
    return oauthCustomTabExchangeAttempted;
}

export function getOAuthSignInOutcome(): 'success' | 'failed' | null {
    return oauthSignInOutcome;
}

export function isStaleOAuthCallbackError(error: unknown): boolean {
    const raw = error instanceof Error ? error.message : String(error);
    return (
        raw.includes('Unknown authorization session') ||
        raw.includes('Missing "state" parameter') ||
        raw.toLowerCase().includes('missing state')
    );
}

async function exchangeOAuthCallback(
    oauthClient: FlipExpoOAuthClient,
    params: URLSearchParams,
    redirectUri: string,
): Promise<OAuthSession> {
    if (oauthExchangeFlight) {
        return oauthExchangeFlight;
    }

    oauthExchangeFlight = (async () => {
        await oauthClient.readyStores();
        const { session } = await oauthClient.callback(params, { redirect_uri: redirectUri });
        return session;
    })();

    try {
        return await oauthExchangeFlight;
    } finally {
        oauthExchangeFlight = null;
    }
}

/** Complete Bluesky OAuth when Android delivers the redirect via deep link instead of Custom Tab. */
export async function completeOAuthCallback(
    params: URLSearchParams,
): Promise<OAuthSession> {
    if (oauthSignInFlight) {
        try {
            return await withTimeout(oauthSignInFlight, OAUTH_SIGNIN_WAIT_MS, 'OAuth sign-in');
        } catch {
            // Custom Tab path failed; do not re-exchange the same callback params.
        }
    }

    if (oauthExchangeFlight) {
        return oauthExchangeFlight;
    }

    // Android often delivers the redirect to both Custom Tab and expo-router; the Custom Tab
    // path already consumed (or failed on) this authorization — a second exchange 404s state.
    if (oauthCustomTabExchangeAttempted) {
        throw new Error('Duplicate OAuth callback after Custom Tab exchange');
    }

    const oauthClient = getOAuthClient();
    const redirectUri = getCustomRedirectUri(oauthClient);
    return exchangeOAuthCallback(oauthClient, params, redirectUri);
}

export function isOAuthSignInInFlight(): boolean {
    return oauthSignInFlight !== null;
}

export async function waitForOAuthSignIn(timeoutMs = OAUTH_SIGNIN_WAIT_MS): Promise<OAuthSession | null> {
    if (!oauthSignInFlight) {
        return null;
    }
    try {
        return await withTimeout(oauthSignInFlight, timeoutMs, 'OAuth sign-in');
    } catch {
        return null;
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

async function resetOAuthClientUnlocked(force: boolean): Promise<void> {
    if (!force && (oauthSignInFlight || oauthExchangeFlight)) {
        if (__DEV__) {
            console.warn('[auth] Skipping OAuth client reset while sign-in/exchange in flight');
        }
        return;
    }

    if (oauthSignInFlight) {
        try {
            await withTimeout(oauthSignInFlight, OAUTH_SIGNIN_WAIT_MS, 'OAuth sign-in cancel');
        } catch {
            // Abandon in-flight Custom Tab sign-in before wiping stores.
        }
    }
    oauthSignInFlight = null;

    if (oauthExchangeFlight) {
        try {
            await withTimeout(oauthExchangeFlight, OAUTH_SIGNIN_WAIT_MS, 'OAuth exchange cancel');
        } catch {
            // Abandon in-flight deep-link exchange before wiping stores.
        }
    }
    oauthExchangeFlight = null;
    oauthCustomTabExchangeAttempted = false;
    oauthSignInOutcome = null;

    if (client) {
        try {
            await client.clearTransientStores();
        } catch (error) {
            console.warn('[auth] OAuth transient store clear failed:', error);
        }
        try {
            await client[Symbol.asyncDispose]();
        } catch (error) {
            console.warn('[auth] OAuth client dispose failed:', error);
        }
        client = null;
    }

    try {
        await clearOAuthTransientSecureStore();
    } catch (error) {
        console.warn('[auth] OAuth transient store clear failed:', error);
    }
    initError = null;
}

export async function resetOAuthClient(options?: { force?: boolean }): Promise<void> {
    const force = options?.force === true;
    const run = () => resetOAuthClientUnlocked(force);
    const next = resetOAuthClientLock.then(run, run);
    resetOAuthClientLock = next.catch(() => {});
    await next;
}

export function getOAuthClient(): FlipExpoOAuthClient {
    if (initError) {
        throw initError;
    }
    if (!client) {
        try {
            installNativeFetchGlobal();
            client = new FlipExpoOAuthClient({
                handleResolver: 'https://bsky.social',
                clientMetadata: getOAuthClientMetadata(),
            });
        } catch (error) {
            initError =
                error instanceof Error
                    ? error
                    : new Error('OAuth client init failed', { cause: error });
            console.warn('[auth] OAuth client init failed:', initError);
            throw initError;
        }
    }
    return client;
}

const OAUTH_DPOP_RETRY_MAX = 2;

function isDpopNonceOAuthError(error: unknown): boolean {
    const raw = error instanceof Error ? error.message : String(error);
    return raw.includes('use_dpop_nonce') || raw.includes('"use_dpop_nonce"');
}

/** Wrap signIn so deep-link callback routes can await the in-flight Custom Tab flow. */
export async function runOAuthSignIn(
    input: Parameters<FlipExpoOAuthClient['signIn']>[0],
    options?: Parameters<FlipExpoOAuthClient['signIn']>[1],
): Promise<OAuthSession> {
    if (oauthSignInFlight) {
        return oauthSignInFlight;
    }

    oauthCustomTabExchangeAttempted = false;
    oauthSignInOutcome = null;

    oauthSignInFlight = (async () => {
        let lastError: unknown;
        for (let attempt = 0; attempt <= OAUTH_DPOP_RETRY_MAX; attempt++) {
            try {
                // loginWithOAuth resets before calling us; only reset again on DPoP retry.
                if (attempt > 0) {
                    await resetOAuthClient({ force: true });
                }
                const oauthClient = getOAuthClient();
                const session = await oauthClient.signIn(input, options);
                oauthSignInOutcome = 'success';
                return session;
            } catch (error) {
                lastError = error;
                if (!isDpopNonceOAuthError(error) || attempt === OAUTH_DPOP_RETRY_MAX) {
                    oauthSignInOutcome = 'failed';
                    throw error;
                }
                if (__DEV__) {
                    console.warn(
                        `[auth] DPoP nonce mismatch on OAuth sign-in (attempt ${attempt + 1}); resetting`,
                    );
                }
            }
        }
        oauthSignInOutcome = 'failed';
        throw lastError;
    })().finally(() => {
        oauthSignInFlight = null;
    });
    return oauthSignInFlight;
}
