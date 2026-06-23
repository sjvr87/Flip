import { Agent, BskyAgent, type AtpSessionData } from '@atproto/api';
import type { OAuthSession } from '@atproto/oauth-client';

import { triggerAuthFailure } from '@/utils/authEvents';
import { Storage } from '@/utils/cache';

import { isWeb } from '@/utils/runtime';

import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus } from 'react-native';

import { getOAuthClient } from './oauthClient';

const SESSION_KEY = 'flip.atproto.session';
const SERVICE_KEY = 'flip.atproto.service';
const OAUTH_DID_KEY = 'flip.atproto.oauth.did';
const OAUTH_HANDLE_KEY = 'flip.atproto.oauth.handle';

const DEFAULT_SERVICE = 'https://bsky.social';

type OAuthBackedAgent = Agent & {
    session: { did: string; handle?: string };
};

let agent: BskyAgent | null = null;
let oauthAgent: OAuthBackedAgent | null = null;
let oauthDid: string | null = null;
let activeOAuthSession: OAuthSession | null = null;

let pendingSessionRestore: Promise<boolean> | null = null;

/** Set when the server definitively rejects the refresh token (not transient/network). */
let lastRefreshRejected = false;

/** Buffer before JWT expiry to refresh proactively (seconds). */
const TOKEN_EXPIRY_BUFFER_SEC = 60;
const RESUME_REFRESH_TIMEOUT_MS = 10_000;

/** Skip redundant MMKV + SecureStore writes during restore loops. */
let lastPersistedSessionJson: string | null = null;

export class SessionExpiredError extends Error {
    constructor(message = 'Session expired — sign in again') {
        super(message);
        this.name = 'SessionExpiredError';
    }
}

export function trackSessionRestore(promise: Promise<boolean>): void {
    pendingSessionRestore = promise.finally(() => {
        pendingSessionRestore = null;
    });
}

async function awaitSessionRestore(): Promise<void> {
    if (pendingSessionRestore) {
        await pendingSessionRestore;
    }
}

/** Wait for background session restore before starting OAuth (avoids DPoP races). */
export async function awaitPendingSessionRestore(): Promise<void> {
    await awaitSessionRestore();
}

function parseJwtPayload(token: string): { exp?: number } | null {
    try {
        const part = token.split('.')[1];
        if (!part) return null;
        const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const json = globalThis.atob(padded);
        return JSON.parse(json) as { exp?: number };
    } catch {
        return null;
    }
}

export function isAccessTokenExpired(accessJwt: string | undefined | null): boolean {
    if (!accessJwt) return true;
    const payload = parseJwtPayload(accessJwt);
    if (!payload?.exp) return false;
    return Date.now() / 1000 >= payload.exp - TOKEN_EXPIRY_BUFFER_SEC;
}

export function isAuthTokenError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof SessionExpiredError) return true;

    const err = error as { error?: string; status?: number };
    return (
        err.error === 'ExpiredToken' ||
        err.error === 'InvalidToken' ||
        err.error === 'AuthMissing' ||
        err.status === 401
    );
}

export function isRefreshTokenRejected(error: unknown): boolean {
    if (!error) return false;
    const err = error as { error?: string; status?: number };
    if (
        err.error === 'ExpiredToken' ||
        err.error === 'InvalidToken' ||
        err.error === 'AuthMissing'
    ) {
        return true;
    }
    return err.status === 400 || err.status === 401;
}

export function wasRefreshTokenRejected(): boolean {
    return lastRefreshRejected;
}

/** @atproto/api 0.20+: refreshSession lives on CredentialSession, not AtpAgent. */
async function refreshAgentSession(a: BskyAgent): Promise<void> {
    const refresh = a.sessionManager?.refreshSession;
    if (typeof refresh !== 'function') {
        throw new TypeError('sessionManager.refreshSession is not a function');
    }
    await refresh.call(a.sessionManager);
}

export async function tryRefreshSession(): Promise<boolean> {
    if (oauthAgent && oauthDid) {
        try {
            const session = await getOAuthClient().restore(oauthDid, true);
            setOAuthSession(session);
            return true;
        } catch (error) {
            console.warn('[auth] OAuth session refresh failed:', error);
            return false;
        }
    }

    lastRefreshRejected = false;
    await restoreSessionFromStorageIfEmpty();

    const a = getCredentialAgent();
    if (!a.session?.refreshJwt) return false;

    try {
        await refreshAgentSession(a);
        if (a.session) {
            await persistSession(a.session);
            return true;
        }
        return false;
    } catch (error) {
        console.warn('[auth] refreshSession failed:', error);
        if (isRefreshTokenRejected(error)) {
            lastRefreshRejected = true;
            clearSession();
            return false;
        }
        // Transient/offline — keep stored session for retry later.
        return !!a.session;
    }
}

/** Reload persisted tokens when the in-memory agent lost its session (e.g. after a 401). */
export async function restoreSessionFromStorageIfEmpty(): Promise<boolean> {
    if (oauthAgent?.did) return true;
    if (getCredentialAgent().session) return true;
    return resumeSession();
}

async function recoverAuth(): Promise<boolean> {
    if (oauthAgent?.did) return true;

    await restoreSessionFromStorageIfEmpty();

    const refreshed = await tryRefreshSession();
    if (refreshed && !isAccessTokenExpired(getCredentialAgent().session?.accessJwt)) {
        return true;
    }

    try {
        const { trySilentRelogin } = await import('./auth');
        if (await trySilentRelogin()) {
            return true;
        }
    } catch (error) {
        console.warn('[auth] silent re-login during recoverAuth failed:', error);
    }

    return false;
}

/**
 * Ensure the agent has a non-expired access token before authenticated API calls.
 */
export async function ensureFreshSession(): Promise<boolean> {
    if (oauthAgent?.did) return true;

    await awaitSessionRestore();
    await restoreSessionFromStorageIfEmpty();

    const a = getCredentialAgent();
    if (!a.session) return false;
    if (!isAccessTokenExpired(a.session.accessJwt)) return true;

    return tryRefreshSession();
}

function failExpiredSession(reason?: string): never {
    const message = reason ?? 'Session expired — sign in again';
    if (wasRefreshTokenRejected()) {
        triggerAuthFailure(message);
    }
    throw new SessionExpiredError(message);
}

let pendingAuthPrep: Promise<boolean> | null = null;

async function prepareAuthenticatedSession(): Promise<boolean> {
    if (pendingAuthPrep) {
        return pendingAuthPrep;
    }

    pendingAuthPrep = (async () => {
        await awaitSessionRestore();
        await restoreSessionFromStorageIfEmpty();

        const fresh = await ensureFreshSession();
        if (fresh) return true;
        return recoverAuth();
    })().finally(() => {
        pendingAuthPrep = null;
    });

    return pendingAuthPrep;
}

/**
 * Run an authenticated ATProto call with proactive refresh and one retry on token errors.
 */
export async function withAuthenticatedFetch<T>(fn: () => Promise<T>): Promise<T> {
    if (oauthAgent?.did) {
        return fn();
    }

    const ready = await prepareAuthenticatedSession();
    if (!ready) {
        if (!(await hasStoredSession()) || wasRefreshTokenRejected()) {
            failExpiredSession();
        }
        throw new SessionExpiredError('Session expired — sign in again');
    }

    try {
        return await fn();
    } catch (error) {
        if (!isAuthTokenError(error)) throw error;

        await restoreSessionFromStorageIfEmpty();
        const recovered = await recoverAuth();
        if (!recovered) {
            if (wasRefreshTokenRejected()) {
                failExpiredSession();
            }
            throw new SessionExpiredError('Session expired — sign in again');
        }

        try {
            return await fn();
        } catch (retryError) {
            if (isAuthTokenError(retryError)) {
                if (wasRefreshTokenRejected()) {
                    failExpiredSession();
                }
                throw new SessionExpiredError('Session expired — sign in again');
            }
            throw retryError;
        }
    }
}

function createAgent(service: string): BskyAgent {
    return new BskyAgent({
        service,

        persistSession: (_event, session) => {
            // Only persist positive session updates. BskyAgent may emit null on transient
            // refresh failures — never wipe stored tokens unless logout() calls clearSession().
            if (session) {
                void persistSession(session);
            }
        },
    });
}

export function getServiceUrl(): string {
    return Storage.getString(SERVICE_KEY) || DEFAULT_SERVICE;
}

export function getCredentialAgent(): BskyAgent {
    if (!agent) {
        agent = createAgent(getServiceUrl());
    }
    return agent;
}

function readOAuthHandle(): string | undefined {
    return Storage.getString(OAUTH_HANDLE_KEY) || undefined;
}

function createOAuthBackedAgent(session: OAuthSession, handle?: string): OAuthBackedAgent {
    const oauthBacked = new Agent(session);
    oauthBacked.configureProxy('did:web:api.bsky.app#bsky_appview');
    const sessionView = { did: session.did, handle };

    return new Proxy(oauthBacked, {
        get(target, prop, receiver) {
            if (prop === 'session') return sessionView;
            return Reflect.get(target, prop, receiver);
        },
    }) as OAuthBackedAgent;
}

export function setOAuthSession(session: OAuthSession, handle?: string): void {
    activeOAuthSession = session;
    oauthDid = session.did;
    oauthAgent = createOAuthBackedAgent(session, handle);
    Storage.set(OAUTH_DID_KEY, session.did);
    if (handle) {
        Storage.set(OAUTH_HANDLE_KEY, handle);
    }
    agent = null;
}

export async function saveOAuthDid(did: string, handle?: string): Promise<void> {
    oauthDid = did;
    Storage.set(OAUTH_DID_KEY, did);
    if (handle) {
        Storage.set(OAUTH_HANDLE_KEY, handle);
    }
    if (!isWeb) {
        await SecureStore.setItemAsync(OAUTH_DID_KEY, did);
        if (handle) {
            await SecureStore.setItemAsync(OAUTH_HANDLE_KEY, handle);
        }
    }
}

export async function getSavedOAuthDid(): Promise<string | null> {
    const cached = oauthDid ?? Storage.getString(OAUTH_DID_KEY);
    if (cached) return cached;
    if (!isWeb) {
        return (await SecureStore.getItemAsync(OAUTH_DID_KEY)) ?? null;
    }
    return null;
}

export async function hasStoredOAuthSession(): Promise<boolean> {
    return !!(await getSavedOAuthDid());
}

export async function resumeOAuthSession(): Promise<boolean> {
    const did = await getSavedOAuthDid();
    if (!did) return false;

    try {
        const session = await getOAuthClient().restore(did);
        setOAuthSession(session, readOAuthHandle());
        console.warn('[auth] OAuth session restored for', did);
        return true;
    } catch (error) {
        console.warn('[auth] OAuth session restore failed:', error);
        await clearOAuthSession();
        return false;
    }
}

export async function clearOAuthSession(): Promise<void> {
    if (activeOAuthSession) {
        try {
            await activeOAuthSession.signOut();
        } catch {
            // Best-effort sign-out; local wipe proceeds regardless.
        }
    }

    activeOAuthSession = null;
    oauthAgent = null;
    oauthDid = null;
    Storage.delete(OAUTH_DID_KEY);
    Storage.delete(OAUTH_HANDLE_KEY);
    if (!isWeb) {
        await SecureStore.deleteItemAsync(OAUTH_DID_KEY);
        await SecureStore.deleteItemAsync(OAUTH_HANDLE_KEY);
    }
}

export function getAgent(): BskyAgent | OAuthBackedAgent {
    if (oauthAgent) return oauthAgent;
    return getCredentialAgent();
}

export function setServiceUrl(service: string): void {
    const normalized = service.startsWith('http') ? service : `https://${service}`;

    const url = normalized.replace(/\/$/, '');

    Storage.set(SERVICE_KEY, url);

    agent = createAgent(url);

    if (!isWeb) {
        void SecureStore.setItemAsync(SERVICE_KEY, url);
    }
}

export async function persistSession(session: AtpSessionData): Promise<void> {
    const json = JSON.stringify(session);
    if (json === lastPersistedSessionJson) {
        return;
    }
    lastPersistedSessionJson = json;

    Storage.set(SESSION_KEY, json);

    if (!isWeb) {
        await SecureStore.setItemAsync(SESSION_KEY, json);
        console.warn('[auth] session persisted (MMKV + SecureStore)');
    }
}

export function clearSession(): void {
    lastPersistedSessionJson = null;

    Storage.delete(SESSION_KEY);

    Storage.delete(SERVICE_KEY);

    if (!isWeb) {
        void SecureStore.deleteItemAsync(SESSION_KEY);
        void SecureStore.deleteItemAsync(SERVICE_KEY);
    }

    agent = null;
    void clearOAuthSession();
}

export async function hasStoredSession(): Promise<boolean> {
    if (await hasStoredOAuthSession()) return true;

    if (Storage.getString(SESSION_KEY)) return true;

    if (!isWeb) {
        return !!(await SecureStore.getItemAsync(SESSION_KEY));
    }

    return false;
}

export async function resumeSession(): Promise<boolean> {
    if (await resumeOAuthSession()) return true;

    if (!isWeb) {
        const storedService = await SecureStore.getItemAsync(SERVICE_KEY);

        if (storedService) {
            Storage.set(SERVICE_KEY, storedService);

            agent = createAgent(storedService);
        }
    }

    let raw = Storage.getString(SESSION_KEY);

    if (!raw && !isWeb) {
        raw = (await SecureStore.getItemAsync(SESSION_KEY)) ?? undefined;

        if (raw) {
            Storage.set(SESSION_KEY, raw);
        }
    }

    if (!raw) return false;

    console.warn('[auth] session loaded from storage');
    lastPersistedSessionJson = raw;

    let session: AtpSessionData;

    try {
        session = JSON.parse(raw) as AtpSessionData;
    } catch {
        clearSession();

        return false;
    }

    const a = getCredentialAgent();
    const sm = a.sessionManager;

    // Load tokens without AtpAgent.resumeSession() — it always POSTs refreshSession (no body).
    if (sm.session?.refreshJwt !== session.refreshJwt) {
        sm.session = session;
        sm.refreshSessionPromise = undefined;
    }

    if (!sm.session) return false;

    if (!isAccessTokenExpired(session.accessJwt)) {
        // Tokens already on disk — no need to rewrite on every cold start.
        return true;
    }

    const refreshed = await Promise.race([
        tryRefreshSession(),
        new Promise<boolean>((resolve) => {
            setTimeout(() => {
                console.warn('[auth] refresh during resume timed out — keeping stored session');
                resolve(false);
            }, RESUME_REFRESH_TIMEOUT_MS);
        }),
    ]);
    if (!refreshed) {
        if (wasRefreshTokenRejected()) {
            return false;
        }
        if (isAccessTokenExpired(sm.session?.accessJwt)) {
            console.warn('[auth] access token still expired after resume');
        }
    }

    if (sm.session) {
        await persistSession(sm.session);
    }

    return !!sm.session;
}

export function getAccessToken(): string | null {
    if (oauthAgent) return null;
    return getCredentialAgent().session?.accessJwt ?? null;
}

export function isOAuthAuthenticated(): boolean {
    return !!oauthAgent?.did;
}

export function isAuthenticated(): boolean {
    if (oauthAgent?.did) return true;
    return !!getCredentialAgent().session;
}

type SessionResumeHandler = () => void;

let sessionResumeHandler: SessionResumeHandler | null = null;
let sessionResumeListenerInstalled = false;

/** authStore registers syncAuthState so resume refresh updates UI. */
export function setSessionResumeHandler(handler: SessionResumeHandler | null): void {
    sessionResumeHandler = handler;
}

/** Proactively refresh JWTs when the app returns to foreground. */
export function installSessionResumeRefresh(): void {
    if (sessionResumeListenerInstalled || isWeb) return;
    sessionResumeListenerInstalled = true;

    let lastState: AppStateStatus = AppState.currentState;

    AppState.addEventListener('change', (nextState) => {
        const wasBackground = lastState.match(/inactive|background/);
        lastState = nextState;

        if (nextState !== 'active' || !wasBackground) return;

        void (async () => {
            await awaitSessionRestore();
            const hasSession = await hasStoredSession();
            if (!hasSession && !isAuthenticated()) return;

            const refreshed = await tryRefreshSession();
            if (refreshed) {
                sessionResumeHandler?.();
            }
        })();
    });
}
