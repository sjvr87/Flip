import { profileToFlipUser } from './adapters';
import { normalizeBlueskyIdentifier } from './identifiers';
import { clearFollowingDidsCache, warmFollowingDidsCache } from './feeds';
import {
    clearSession,
    ensureFreshSession,
    getAgent,
    getCredentialAgent,
    getServiceUrl,
    isAccessTokenExpired,
    isAuthenticated,
    isOAuthAuthenticated,
    persistSession,
    resumeSession,
    saveOAuthDid,
    setOAuthSession,
    setServiceUrl,
    tryRefreshSession,
    wasRefreshTokenRejected,
    withAuthenticatedFetch,
} from './agent';
import { clearCredentials, getSavedCredentials } from './credentialVault';
import { resolveOAuthCallbackSearchParams } from './oauthCallbackUrl';
import {
    completeOAuthCallback,
    resetOAuthClient,
    runOAuthSignIn,
} from './oauthClient';
import {
    oauthMetadataPreflightMessage,
    preflightOAuthClientMetadata,
} from './oauthClientMetadata';
import type { FlipAppConfig, FlipUserProfile } from './types';
import { Storage } from '@/utils/cache';

const PROFILE_KEY = 'flip.user.profile';
const PROFILE_FETCH_TIMEOUT_MS = 3_000;

export type FlipSessionUser = FlipUserProfile;

/** Pull error_description / OAuth error code out of SDK or fetch error strings. */
function extractOAuthDetail(raw: string): string | null {
    const desc = raw.match(/"error_description"\s*:\s*"([^"]+)"/i)?.[1];
    if (desc) return desc;
    const code = raw.match(/"error"\s*:\s*"([^"]+)"/i)?.[1];
    if (code && code !== 'invalid_request') return code;
    const trimmed = raw.trim();
    if (trimmed.length > 0 && trimmed.length < 280) return trimmed;
    return null;
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

/** Refresh cached profile without blocking session restore. */
function fetchProfileInBackground(): void {
    void (async () => {
        try {
            await withTimeout(
                withAuthenticatedFetch(async () => {
                    const agent = getAgent();
                    const did = agent.session?.did;
                    if (!did) return;
                    const profile = await agent.getProfile({ actor: did });
                    const user = profileToFlipUser(profile.data, true);
                    Storage.set(PROFILE_KEY, JSON.stringify(user));
                }),
                PROFILE_FETCH_TIMEOUT_MS,
                'profileFetch',
            );
        } catch (error) {
            console.warn('[auth] profile refresh during hydrate failed:', error);
            if (wasRefreshTokenRejected()) {
                clearSession();
            }
        }
    })();
}

/** Map Bluesky OAuth / SecureStore failures to actionable sign-in messages. */
function mapOAuthSignInError(error: unknown): string {
    const raw =
        error instanceof Error ? error.message : 'Bluesky sign-in was cancelled or failed.';
    const detail = extractOAuthDetail(raw);

    if (raw.toLowerCase().includes('cancel')) {
        return 'Sign-in cancelled.';
    }
    if (raw.includes('Failed to resolve identity')) {
        return 'Could not reach Bluesky for sign-in. Check your connection and try again.';
    }
    if (
        raw.includes('Invalid key provided to SecureStore') ||
        (raw.includes('SecureStore') && raw.includes('Invalid key'))
    ) {
        return 'Sign-in storage failed (invalid secure key). Close the app, reopen, and try again.';
    }
    if (raw.includes('use_dpop_nonce') || raw.includes('"use_dpop_nonce"')) {
        return 'Bluesky sign-in security handshake failed. Close the app, reopen, and try again.';
    }
    if (raw.includes('Missing "state" parameter') || raw.includes('missing state')) {
        return 'Sign-in expired or was interrupted. Tap Continue with Bluesky and try again.';
    }
    if (raw.includes('Unknown authorization session')) {
        return 'Sign-in session expired. Tap Continue with Bluesky and try again.';
    }
    if (raw.includes('invalid_redirect_uri')) {
        return detail
            ? `Bluesky rejected the redirect URI: ${detail}`
            : 'Bluesky rejected the OAuth redirect URI (scheme must match client_id host in reverse-domain order).';
    }
    if (raw.includes('Invalid client metadata content type')) {
        return detail
            ? `Bluesky could not read OAuth metadata (wrong content type): ${detail}`
            : 'Bluesky could not read OAuth metadata (host returned HTML instead of JSON).';
    }
    if (
        raw.includes('client metadata') ||
        raw.includes('invalid_client')
    ) {
        return detail
            ? `Bluesky OAuth client error: ${detail}`
            : `Bluesky OAuth client error: ${raw}`;
    }
    return detail ?? raw;
}

export async function loginWithOAuth(): Promise<FlipSessionUser> {
    clearSession();
    clearFollowingDidsCache();

    await resetOAuthClient();

    const preflight = await preflightOAuthClientMetadata();
    if (!preflight.ok) {
        throw new Error(oauthMetadataPreflightMessage(preflight));
    }

    let session;
    try {
        // PDS URL (https://) — not handle "bsky.social" — or OAuth resolver treats it as identity and fails.
        session = await runOAuthSignIn('https://bsky.social');
    } catch (error) {
        if (__DEV__) {
            console.warn('[auth] Bluesky OAuth error:', error);
        }
        throw new Error(mapOAuthSignInError(error));
    }

    setOAuthSession(session);
    setServiceUrl('bsky.social');

    const agent = getAgent();
    const profile = await agent.getProfile({ actor: session.did });
    const user = profileToFlipUser(profile.data, true);
    await saveOAuthDid(session.did, user.username);
    setOAuthSession(session, user.username);

    Storage.delete('app.token');
    Storage.delete('app.instance');
    Storage.set(PROFILE_KEY, JSON.stringify(user));

    void warmFollowingDidsCache();
    return user;
}

/** Finish OAuth when expo-router receives net.jsdelivr.cdn:/oauth/callback (deep link). */
export async function completeOAuthRedirect(
    params: Record<string, string | string[] | undefined>,
    linkingUrl?: string | null,
): Promise<FlipSessionUser> {
    const { searchParams } = await resolveOAuthCallbackSearchParams(params, linkingUrl);

    if (searchParams.get('error')) {
        const message =
            searchParams.get('error_description') ??
            searchParams.get('error') ??
            'Authentication failed';
        throw new Error(message);
    }

    if (!searchParams.get('code') && !searchParams.get('state')) {
        throw new Error('Missing "state" parameter');
    }

    const session = await completeOAuthCallback(searchParams);

    setOAuthSession(session);
    setServiceUrl('bsky.social');

    const agent = getAgent();
    const profile = await agent.getProfile({ actor: session.did });
    const user = profileToFlipUser(profile.data, true);
    await saveOAuthDid(session.did, user.username);
    setOAuthSession(session, user.username);

    Storage.delete('app.token');
    Storage.delete('app.instance');
    Storage.set(PROFILE_KEY, JSON.stringify(user));

    void warmFollowingDidsCache();
    return user;
}

export async function loginWithPassword(
    identifier: string,
    password: string,
    service?: string,
): Promise<FlipSessionUser> {
    // Drop stale tokens so login does not race with a broken refreshSession.
    clearSession();
    clearFollowingDidsCache();

    if (service) {
        setServiceUrl(service);
    }

    const agent = getCredentialAgent();
    const normalizedIdentifier = normalizeBlueskyIdentifier(identifier);
    let result: Awaited<ReturnType<typeof agent.login>>;
    try {
        result = await agent.login({ identifier: normalizedIdentifier, password });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Could not reach Bluesky. Check your connection and try again.';
        throw new Error(message);
    }

    if (!result.success || !agent.session) {
        const message =
            typeof (result as { data?: { message?: string } }).data?.message === 'string'
                ? (result as { data: { message: string } }).data.message
                : 'Invalid handle or app password.';
        throw new Error(message);
    }

    await persistSession(agent.session);

    const sessionOk = await ensureFreshSession();
    if (!sessionOk) {
        throw new Error('Signed in but session could not be verified. Try again.');
    }

    // Bluesky login — drop stale Loops REST credentials so routing uses ATProto.
    Storage.delete('app.token');
    Storage.delete('app.instance');

    const profile = await agent.getProfile({ actor: agent.session.did });
    const user = profileToFlipUser(profile.data, true);
    Storage.set(PROFILE_KEY, JSON.stringify(user));

    void warmFollowingDidsCache();

    return user;
}

export async function hydrateSession(): Promise<boolean> {
    const ok = await resumeSession();
    if (!ok) return false;

    Storage.delete('app.token');
    Storage.delete('app.instance');

    if (!isAuthenticated()) return false;

    if (isOAuthAuthenticated()) {
        fetchProfileInBackground();
        void warmFollowingDidsCache();
        return true;
    }

    const session = getCredentialAgent().session;
    if (!session) return false;

    if (wasRefreshTokenRejected()) {
        clearSession();
        return false;
    }

    if (!isAccessTokenExpired(session.accessJwt)) {
        fetchProfileInBackground();
        void warmFollowingDidsCache();
        return true;
    }

    fetchProfileInBackground();
    void warmFollowingDidsCache();
    return true;
}

export async function refreshSession(): Promise<boolean> {
    return tryRefreshSession();
}

export function getCurrentUser(): FlipSessionUser | null {
    const raw = Storage.getString(PROFILE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as FlipSessionUser;
    } catch {
        return null;
    }
}

export function getCurrentServer(): string {
    try {
        const url = new URL(getServiceUrl());
        return url.host;
    } catch {
        return 'bsky.social';
    }
}

export async function trySilentRelogin(): Promise<boolean> {
    const creds = await getSavedCredentials();
    if (!creds) return false;

    try {
        await loginWithPassword(creds.identifier, creds.password, creds.service);
        return true;
    } catch (error) {
        console.warn('[auth] silent re-login failed:', error);
        return false;
    }
}

export function logout(): void {
    clearSession();
    clearFollowingDidsCache();
    void clearCredentials();
    Storage.delete(PROFILE_KEY);
    Storage.delete('app.token');
    Storage.delete('app.instance');
}

export { isAuthenticated, getServiceUrl };

export async function fetchSelfAccount(): Promise<{ data: FlipUserProfile }> {
    const agent = getAgent();
    const did = agent.session?.did;
    if (!did) throw new Error('Not authenticated');

    const profile = await agent.getProfile({ actor: did });
    const user = profileToFlipUser(profile.data, true);
    Storage.set(PROFILE_KEY, JSON.stringify(user));

    return { data: user };
}

export async function getConfiguration(): Promise<FlipAppConfig> {
    return {
        fyf: true,
        registration: false,
    };
}

export async function getPreferences(): Promise<{ settings: Record<string, unknown> }> {
    return {
        settings: {
            hide_for_you_feed: false,
            default_feed: 'following',
            autoplay_videos: true,
            loop_videos: true,
            mute_on_open: false,
            auto_expand_cw: false,
            appearance: 'system',
        },
    };
}

export async function updatePreferences(_prefs: Record<string, unknown>): Promise<void> {
    // Stored locally in authStore for Flip; no Bluesky prefs API yet
}

export async function openBrowser(url: string, _options?: Record<string, unknown>): Promise<void> {
    const WebBrowser = await import('expo-web-browser');
    await WebBrowser.openBrowserAsync(url);
}
