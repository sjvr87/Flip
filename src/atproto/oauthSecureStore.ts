import type { SimpleStore, Value } from '@atproto-labs/simple-store';
import * as SecureStore from 'expo-secure-store';

import { secureStoreKeySegment } from './secureStoreKeySegment';

export type SecureSimpleStoreTTLOptions<V extends Value> = {
    storagePrefix: string;
    expiresAt: (value: V) => null | number;
    decode: (value: string) => V;
    encode: (value: V) => string;
    clearInterval?: null | false | number;
};

type StoredEntry = {
    v: string;
    exp: number | null;
};

/**
 * SecureStore-backed TTL cache for OAuth data that must survive the browser
 * redirect (DPoP nonces, authorization state). In-memory layer for hot reads.
 */
export class SecureSimpleStoreTTL<V extends Value>
    implements SimpleStore<string, V>, Disposable
{
    readonly #cache = new Map<string, V>();
    readonly #exp = new Map<string, number>();
    readonly #prefix: string;
    readonly #expiresAt: (value: V) => null | number;
    readonly #decode: (value: string) => V;
    readonly #encode: (value: V) => string;
    readonly #clearTimer?: ReturnType<typeof setInterval>;
    readonly #pendingWrites = new Map<string, Promise<void>>();

    constructor({
        clearInterval = 60 * 1e3,
        expiresAt,
        encode,
        decode,
        storagePrefix,
    }: SecureSimpleStoreTTLOptions<V>) {
        this.#prefix = storagePrefix;
        this.#expiresAt = expiresAt;
        this.#encode = encode;
        this.#decode = decode;
        if (clearInterval) {
            this.#clearTimer = setInterval(() => this.clearExpired(), clearInterval);
        }
        this.clearExpired();
    }

    [Symbol.dispose]() {
        clearInterval(this.#clearTimer);
        this.clearExpired();
    }

    #storageKey(key: string): string {
        return `${this.#prefix}.${secureStoreKeySegment(key)}`;
    }

    get(key: string): V | undefined | Promise<V | undefined> {
        if (this.isExpired(key)) {
            void this.del(key);
            return undefined;
        }
        const cached = this.#cache.get(key);
        if (cached !== undefined) return cached;
        return this.#load(key);
    }

    async #load(key: string): Promise<V | undefined> {
        try {
            const raw = await SecureStore.getItemAsync(this.#storageKey(key));
            if (!raw) return undefined;
            const entry = JSON.parse(raw) as StoredEntry;
            if (entry.exp != null && entry.exp < Date.now()) {
                await this.#remove(key);
                return undefined;
            }
            const value = this.#decode(entry.v);
            this.#cache.set(key, value);
            if (entry.exp != null) this.#exp.set(key, entry.exp);
            return value;
        } catch (error) {
            console.warn(`[auth] OAuth store read failed (${this.#prefix}):`, error);
            return undefined;
        }
    }

    set(key: string, value: V): void | Promise<void> {
        this.#cache.set(key, value);
        const expirationDate = this.#expiresAt.call(null, value);
        if (expirationDate == null) this.#exp.delete(key);
        else this.#exp.set(key, expirationDate);
        const write = this.#persist(key, value, expirationDate);
        this.#pendingWrites.set(key, write);
        void write.finally(() => {
            if (this.#pendingWrites.get(key) === write) {
                this.#pendingWrites.delete(key);
            }
        });
        return write;
    }

    /** Await in-flight SecureStore writes (e.g. before opening the OAuth browser). */
    async ready(): Promise<void> {
        if (this.#pendingWrites.size === 0) return;
        await Promise.all([...this.#pendingWrites.values()]);
    }

    #indexStorageKey(): string {
        return `${this.#prefix}.__index__`;
    }

    async #readIndex(): Promise<string[]> {
        try {
            const raw = await SecureStore.getItemAsync(this.#indexStorageKey());
            if (!raw) return [];
            const keys = JSON.parse(raw) as string[];
            return Array.isArray(keys) ? keys : [];
        } catch {
            return [];
        }
    }

    async #writeIndex(keys: string[]): Promise<void> {
        try {
            if (keys.length === 0) {
                await SecureStore.deleteItemAsync(this.#indexStorageKey());
            } else {
                await SecureStore.setItemAsync(this.#indexStorageKey(), JSON.stringify(keys));
            }
        } catch (error) {
            console.warn(`[auth] OAuth store index write failed (${this.#prefix}):`, error);
        }
    }

    async #trackKey(key: string): Promise<void> {
        const keys = await this.#readIndex();
        if (keys.includes(key)) return;
        keys.push(key);
        await this.#writeIndex(keys);
    }

    async #untrackKey(key: string): Promise<void> {
        const keys = await this.#readIndex();
        const next = keys.filter((entry) => entry !== key);
        if (next.length === keys.length) return;
        await this.#writeIndex(next);
    }

    async #persist(key: string, value: V, exp: number | null): Promise<void> {
        try {
            const entry: StoredEntry = { v: this.#encode(value), exp };
            await SecureStore.setItemAsync(this.#storageKey(key), JSON.stringify(entry));
            await this.#trackKey(key);
        } catch (error) {
            console.warn(`[auth] OAuth store persist failed (${this.#prefix}):`, error);
            throw error;
        }
    }

    del(key: string): void | Promise<void> {
        this.#cache.delete(key);
        this.#exp.delete(key);
        return this.#remove(key);
    }

    async #remove(key: string): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(this.#storageKey(key));
            await this.#untrackKey(key);
        } catch (error) {
            console.warn(`[auth] OAuth store delete failed (${this.#prefix}):`, error);
        }
    }

    clear(): void {
        this.#cache.clear();
        this.#exp.clear();
    }

    /** Wipe in-memory and SecureStore entries (e.g. before a fresh OAuth sign-in). */
    async clearPersisted(): Promise<void> {
        await this.ready();
        const keys = await this.#readIndex();
        await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(this.#storageKey(key))));
        await this.#writeIndex([]);
        this.clear();
    }

    isExpired(key: string): boolean {
        const expirationTime = this.#exp.get(key);
        return expirationTime != null && expirationTime < Date.now();
    }

    clearExpired(): void {
        for (const key of this.#cache.keys()) {
            if (this.isExpired(key)) {
                void this.del(key);
            }
        }
    }
}
