import type { SimpleStore, Value } from '@atproto-labs/simple-store';

export type MemorySimpleStoreTTLOptions<V extends Value> = {
    expiresAt: (value: V) => null | number;
    decode: (value: string) => V;
    encode: (value: V) => string;
    clearInterval?: null | false | number;
};

/**
 * In-memory TTL store matching @atproto/oauth-client-expo MMKV behavior without JSI/MMKV.
 */
export class MemorySimpleStoreTTL<V extends Value>
    implements SimpleStore<string, V>, Disposable
{
    readonly #data = new Map<string, string>();
    readonly #exp = new Map<string, number>();
    readonly #expiresAt: (value: V) => null | number;
    readonly #decode: (value: string) => V;
    readonly #encode: (value: V) => string;
    readonly #clearTimer?: ReturnType<typeof setInterval>;

    constructor({
        clearInterval = 60 * 1e3,
        expiresAt,
        encode,
        decode,
    }: MemorySimpleStoreTTLOptions<V>) {
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

    set(key: string, value: V): void {
        this.#data.set(key, this.#encode(value));
        const expirationDate = this.#expiresAt.call(null, value);
        if (expirationDate == null) this.#exp.delete(key);
        else this.#exp.set(key, expirationDate);
    }

    get(key: string): V | undefined {
        if (this.isExpired(key)) {
            this.del(key);
            return undefined;
        }
        const raw = this.#data.get(key);
        if (raw === undefined) return undefined;
        return this.#decode(raw);
    }

    del(key: string): void {
        this.#data.delete(key);
        this.#exp.delete(key);
    }

    clear(): void {
        this.#data.clear();
        this.#exp.clear();
    }

    isExpired(key: string): boolean {
        const expirationTime = this.#exp.get(key);
        return expirationTime != null && expirationTime < Date.now();
    }

    clearExpired(): void {
        for (const key of this.#data.keys()) {
            if (this.isExpired(key)) {
                this.del(key);
            }
        }
    }
}
