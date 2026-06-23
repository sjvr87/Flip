import * as WebBrowser from 'expo-web-browser';
import { openAuthSessionAsync } from 'expo-web-browser';
import { OAuthClient } from '@atproto/oauth-client';
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
} from './oauthStores.native';

// JSI polyfills (DisposableStack, URL) required by @atproto/oauth-client-expo.
require('@atproto/oauth-client-expo/dist/polyfill.native');

WebBrowser.maybeCompleteAuthSession();

const CUSTOM_URI_SCHEME_REGEX = /^(?:[^.]+(?:\.[^.]+)+):\/(?:[^/].*)?$/;
const isCustomUriScheme = (uri: string) => CUSTOM_URI_SCHEME_REGEX.test(uri);

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
        await Promise.all([this.#dpopNonceCache.ready(), this.#stateStore.ready()]);

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
            const { session } = await this.callback(params, {
                redirect_uri: redirectUri,
            });
            return session;
        }

        throw new Error(`Authentication cancelled: ${result.type}`);
    }

    async [Symbol.asyncDispose]() {
        this.#disposables.dispose();
    }
}

export type ExpoOAuthClient = FlipExpoOAuthClient;

let client: FlipExpoOAuthClient | null = null;
let initError: Error | null = null;

export async function resetOAuthClient(): Promise<void> {
    if (client) {
        try {
            await client[Symbol.asyncDispose]();
        } catch (error) {
            console.warn('[auth] OAuth client dispose failed:', error);
        }
        client = null;
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
