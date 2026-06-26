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

export async function completeOAuthCallback(_params: URLSearchParams): Promise<never> {
    throw new Error('OAuth deep-link callback is only supported on native.');
}

export function isOAuthSignInInFlight(): boolean {
    return false;
}

export async function waitForOAuthSignIn(): Promise<null> {
    return null;
}

export function wasOAuthCustomTabExchangeAttempted(): boolean {
    return false;
}

export function getOAuthSignInOutcome(): 'success' | 'failed' | null {
    return null;
}

export function isStaleOAuthCallbackError(_error: unknown): boolean {
    return false;
}

export async function runOAuthSignIn(_input: string, _options?: unknown): Promise<never> {
    throw new Error('OAuth sign-in is only supported on native.');
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
