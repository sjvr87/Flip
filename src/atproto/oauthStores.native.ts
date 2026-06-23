import type { SimpleStore } from '@atproto-labs/simple-store';
import type {
    DidDocument,
    InternalStateData,
    OAuthAuthorizationServerMetadata,
    OAuthProtectedResourceMetadata,
    ResolvedHandle,
    Session,
} from '@atproto/oauth-client';
const { ExpoKey } = require('@atproto/oauth-client-expo/dist/utils/expo-key');
import * as SecureStore from 'expo-secure-store';

import { MemorySimpleStoreTTL } from './oauthMemoryStore';

const SESSION_INDEX_KEY = 'flip.oauth.expo.sessions';

function sessionStorageKey(sub: string): string {
    return `flip.oauth.expo.session.${encodeURIComponent(sub)}`;
}

function identity<T>(x: T): T {
    return x;
}

function tenMinutesFromNow() {
    return Date.now() + 10 * 60e3;
}

function oneMinuteFromNow() {
    return Date.now() + 60e3;
}

export class AuthorizationServerMetadataCache extends MemorySimpleStoreTTL<OAuthAuthorizationServerMetadata> {
    constructor() {
        super({
            expiresAt: oneMinuteFromNow,
            decode: JSON.parse,
            encode: JSON.stringify,
        });
    }
}

export class ProtectedResourceMetadataCache extends MemorySimpleStoreTTL<OAuthProtectedResourceMetadata | null> {
    constructor() {
        super({
            expiresAt: oneMinuteFromNow,
            decode: JSON.parse,
            encode: JSON.stringify,
        });
    }
}

export class DpopNonceCache extends MemorySimpleStoreTTL<string> {
    constructor() {
        super({
            expiresAt: tenMinutesFromNow,
            decode: identity,
            encode: identity,
        });
    }
}

export class DidCache extends MemorySimpleStoreTTL<DidDocument> {
    constructor() {
        super({
            expiresAt: oneMinuteFromNow,
            decode: JSON.parse,
            encode: JSON.stringify,
        });
    }
}

export class HandleCache extends MemorySimpleStoreTTL<ResolvedHandle> {
    constructor() {
        super({
            expiresAt: oneMinuteFromNow,
            decode: JSON.parse,
            encode: JSON.stringify,
        });
    }
}

export class StateStore extends MemorySimpleStoreTTL<InternalStateData> {
    constructor() {
        super({
            expiresAt: tenMinutesFromNow,
            decode: (value) => {
                const parsed = JSON.parse(value);
                return { ...parsed, dpopKey: new ExpoKey(parsed.dpopKey) };
            },
            encode: (value) => {
                return JSON.stringify({ ...value, dpopKey: value.dpopKey.jwk });
            },
        });
    }
}

function encodeSession(value: Session): string {
    return JSON.stringify({ ...value, dpopKey: value.dpopKey.jwk });
}

function decodeSession(value: string): Session {
    const parsed = JSON.parse(value);
    return { ...parsed, dpopKey: new ExpoKey(parsed.dpopKey) };
}

/**
 * OAuth session persistence without MMKV (SecureStore + memory). Supports async get for cold start restore.
 */
export class SessionStore implements SimpleStore<string, Session>, Disposable {
    readonly #cache = new Map<string, Session>();

    [Symbol.dispose]() {}

    get(key: string): Session | undefined | Promise<Session | undefined> {
        const cached = this.#cache.get(key);
        if (cached) return cached;
        return this.#load(key);
    }

    async #load(key: string): Promise<Session | undefined> {
        try {
            const raw = await SecureStore.getItemAsync(sessionStorageKey(key));
            if (!raw) return undefined;
            const session = decodeSession(raw);
            this.#cache.set(key, session);
            return session;
        } catch (error) {
            console.warn('[auth] OAuth session read failed:', error);
            return undefined;
        }
    }

    set(key: string, value: Session): void {
        this.#cache.set(key, value);
        void this.#persist(key, value);
    }

    async #persist(key: string, value: Session): Promise<void> {
        try {
            await SecureStore.setItemAsync(sessionStorageKey(key), encodeSession(value));
            const raw = await SecureStore.getItemAsync(SESSION_INDEX_KEY);
            const subs: string[] = raw ? (JSON.parse(raw) as string[]) : [];
            if (!subs.includes(key)) {
                subs.push(key);
                await SecureStore.setItemAsync(SESSION_INDEX_KEY, JSON.stringify(subs));
            }
        } catch (error) {
            console.warn('[auth] OAuth session persist failed:', error);
        }
    }

    del(key: string): void {
        this.#cache.delete(key);
        void this.#remove(key);
    }

    async #remove(key: string): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(sessionStorageKey(key));
            const raw = await SecureStore.getItemAsync(SESSION_INDEX_KEY);
            if (!raw) return;
            const subs = (JSON.parse(raw) as string[]).filter((sub) => sub !== key);
            if (subs.length === 0) {
                await SecureStore.deleteItemAsync(SESSION_INDEX_KEY);
            } else {
                await SecureStore.setItemAsync(SESSION_INDEX_KEY, JSON.stringify(subs));
            }
        } catch (error) {
            console.warn('[auth] OAuth session delete failed:', error);
        }
    }

    clear(): void {
        this.#cache.clear();
    }
}
