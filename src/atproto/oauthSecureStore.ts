import type { SimpleStore, Value } from '@atproto-labs/simple-store';
import * as SecureStore from 'expo-secure-store';

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
        return `${this.#prefix}.${encodeURIComponent(key)}`;
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
        return this.#persist(key, value, expirationDate);
    }

    async #persist(key: string, value: V, exp: number | null): Promise<void> {
        try {
            const entry: StoredEntry = { v: this.#encode(value), exp };
            await SecureStore.setItemAsync(this.#storageKey(key), JSON.stringify(entry));
        } catch (error) {
            console.warn(`[auth] OAuth store persist failed (${this.#prefix}):`, error);
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
        } catch (error) {
            console.warn(`[auth] OAuth store delete failed (${this.#prefix}):`, error);
        }
    }

    clear(): void {
        this.#cache.clear();
        this.#exp.clear();
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
