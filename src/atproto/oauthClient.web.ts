import * as WebBrowser from 'expo-web-browser';

import { getOAuthClientMetadata } from './oauthClientMetadata';

import type { ExpoOAuthClient as ExpoOAuthClientType } from '@atproto/oauth-client-expo/dist/expo-oauth-client.web';

require('@atproto/oauth-client-expo/dist/polyfill.web');

const { ExpoOAuthClient } = require('@atproto/oauth-client-expo/dist/expo-oauth-client.web');

WebBrowser.maybeCompleteAuthSession();

let client: ExpoOAuthClientType | null = null;
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

export function getOAuthClient(): ExpoOAuthClientType {
    if (initError) {
        throw initError;
    }
    if (!client) {
        try {
            client = new ExpoOAuthClient({
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
