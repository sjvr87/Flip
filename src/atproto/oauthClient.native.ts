import * as WebBrowser from 'expo-web-browser';
import { openAuthSessionAsync } from 'expo-web-browser';
import { OAuthClient, type OAuthSession } from '@atproto/oauth-client';
const NativeModule = require('@atproto/oauth-client-expo/dist/ExpoAtprotoOAuthClientModule').default;
const { ExpoKey } = require('@atproto/oauth-client-expo/dist/utils/expo-key');

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

    /** Await SecureStore writes before browser redirect or token exchange. */
    async readyStores(): Promise<void> {
        await Promise.all([this.#dpopNonceCache.ready(), this.#stateStore.ready()]);
    }

    /** Drop stale PKCE/state and DPoP nonces before a new sign-in attempt. */
    async clearTransientStores(): Promise<void> {
        await this.readyStores();
        await Promise.all([
            this.#dpopNonceCache.clearPersisted(),
            this.#stateStore.clearPersisted(),
        ]);
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
            // Custom Tab path failed; fall through to deep-link exchange.
        }
    }

    if (oauthExchangeFlight) {
        return oauthExchangeFlight;
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

export async function resetOAuthClient(): Promise<void> {
    if (oauthSignInFlight) {
        try {
            await withTimeout(oauthSignInFlight, 500, 'OAuth sign-in cancel');
        } catch {
            // Abandon in-flight Custom Tab sign-in before wiping stores.
        }
    }
    oauthSignInFlight = null;

    if (oauthExchangeFlight) {
        try {
            await withTimeout(oauthExchangeFlight, 500, 'OAuth exchange cancel');
        } catch {
            // Abandon in-flight deep-link exchange before wiping stores.
        }
    }
    oauthExchangeFlight = null;

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

export function getOAuthClient(): FlipExpoOAuthClient {
    if (initError) {
        throw initError;
    }
    if (!client) {
        try {
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

    oauthSignInFlight = (async () => {
        let lastError: unknown;
        for (let attempt = 0; attempt <= OAUTH_DPOP_RETRY_MAX; attempt++) {
            try {
                await resetOAuthClient();
                const oauthClient = getOAuthClient();
                return await oauthClient.signIn(input, options);
            } catch (error) {
                lastError = error;
                if (!isDpopNonceOAuthError(error) || attempt === OAUTH_DPOP_RETRY_MAX) {
                    throw error;
                }
                if (__DEV__) {
                    console.warn(
                        `[auth] DPoP nonce mismatch on OAuth sign-in (attempt ${attempt + 1}); resetting`,
                    );
                }
            }
        }
        throw lastError;
    })().finally(() => {
        oauthSignInFlight = null;
    });
    return oauthSignInFlight;
}
