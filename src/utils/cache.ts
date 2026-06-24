import { useSafeNativeShims } from '@/utils/runtime';
import { Platform } from 'react-native';

export type AppStorage = {
    getString: (key: string) => string | undefined;
    set: (key: string, value: string | number | boolean) => void;
    delete: (key: string) => void;
    remove: (key: string) => void;
};

function isServer(): boolean {
    return typeof window === 'undefined';
}

/**
 * MMKV uses JSI (JavaScript Interface) for synchronous native calls.
 * `nativeCallSyncHook` is the global marker set by the JSI bridge; it is absent when
 * remote Chrome debugging is active (Hermes debugger replaces the JSI bridge), causing
 * MMKV init to crash. Checking for it before loading MMKV prevents that crash.
 */
function canUseMmkvJsi(): boolean {
    return (
        typeof (globalThis as { nativeCallSyncHook?: unknown }).nativeCallSyncHook === 'function'
    );
}

function createMemoryStorage(): AppStorage {
    const map = new Map<string, string>();

    return {
        getString: (key) => map.get(key),
        set: (key, value) => map.set(key, String(value)),
        delete: (key) => {
            map.delete(key);
        },
        remove: (key) => {
            map.delete(key);
        },
    };
}

function createLocalStorage(): AppStorage {
    return {
        getString: (key) => {
            try {
                return window.localStorage.getItem(key) ?? undefined;
            } catch {
                return undefined;
            }
        },
        set: (key, value) => {
            try {
                window.localStorage.setItem(key, String(value));
            } catch {
                // ignore quota / privacy mode errors
            }
        },
        delete: (key) => {
            try {
                window.localStorage.removeItem(key);
            } catch {
                // ignore
            }
        },
        remove: (key) => {
            try {
                window.localStorage.removeItem(key);
            } catch {
                // ignore
            }
        },
    };
}

function createMmkvStorage(): AppStorage | null {
    if (!canUseMmkvJsi()) {
        return null;
    }

    let MMKV: typeof import('react-native-mmkv').MMKV;
    try {
        ({ MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv'));
    } catch (error) {
        console.warn('[storage] react-native-mmkv failed to load', error);
        return null;
    }

    let mmkv: InstanceType<typeof MMKV>;
    try {
        mmkv = new MMKV();
    } catch (error) {
        console.warn('[storage] MMKV init failed (disable remote JS debugging if enabled)', error);
        return null;
    }

    return {
        getString: (key) => mmkv.getString(key),
        set: (key, value) => mmkv.set(key, value),
        delete: (key) => mmkv.delete(key),
        remove: (key) => mmkv.delete(key),
    };
}

function createNativeStorage(): AppStorage {
    if (useSafeNativeShims) {
        console.log('[storage] Expo Go / safe mode - using in-memory storage');
        return createMemoryStorage();
    }

    const mmkv = createMmkvStorage();
    if (mmkv) {
        console.log('[storage] Using MMKV');
        return mmkv;
    }

    console.warn('[storage] MMKV unavailable, using in-memory storage');
    return createMemoryStorage();
}

let storageInstance: AppStorage | null = null;

function getStorageInstance(): AppStorage {
    if (storageInstance) return storageInstance;

    if (isServer()) {
        storageInstance = createMemoryStorage();
    } else if (Platform.OS === 'web') {
        storageInstance = createLocalStorage();
    } else {
        storageInstance = createNativeStorage();
    }

    return storageInstance;
}

/** SSR-safe storage: memory on server, localStorage on web, MMKV on native. */
export const Storage: AppStorage = {
    getString: (key) => getStorageInstance().getString(key),
    set: (key, value) => getStorageInstance().set(key, value),
    delete: (key) => getStorageInstance().delete(key),
    remove: (key) => getStorageInstance().remove(key),
};
