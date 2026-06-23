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
import { getOAuthClient } from './oauthClient';
import type { FlipAppConfig, FlipUserProfile } from './types';
import { Storage } from '@/utils/cache';

const PROFILE_KEY = 'flip.user.profile';
const PROFILE_FETCH_TIMEOUT_MS = 3_000;

export type FlipSessionUser = FlipUserProfile;

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

export async function loginWithOAuth(): Promise<FlipSessionUser> {
    clearSession();
    clearFollowingDidsCache();

    let session;
    try {
        // PDS URL (https://) — not handle "bsky.social" — or OAuth resolver treats it as identity and fails.
        session = await getOAuthClient().signIn('https://bsky.social');
    } catch (error) {
        const raw =
            error instanceof Error ? error.message : 'Bluesky sign-in was cancelled or failed.';
        if (raw.toLowerCase().includes('cancel')) {
            throw new Error('Sign-in cancelled.');
        }
        if (raw.includes('Failed to resolve identity')) {
            throw new Error(
                'Could not reach Bluesky for sign-in. Check your connection, or use an app password below.',
            );
        }
        if (
            raw.includes('client metadata') ||
            raw.includes('client_id') ||
            raw.includes('invalid_client')
        ) {
            throw new Error(
                'Bluesky browser sign-in is not available on this build. Use an app password below.',
            );
        }
        if (
            raw.includes('use_dpop_nonce') ||
            (raw.toLowerCase().includes('dpop') && raw.toLowerCase().includes('nonce'))
        ) {
            throw new Error(
                'Bluesky browser sign-in hit a security handshake error. Try again, or use an app password below.',
            );
        }
        throw new Error(raw);
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
