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

function createMmkvStorage(): AppStorage {
    let MMKV: typeof import('react-native-mmkv').MMKV;
    try {
        ({ MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv'));
    } catch (error) {
        throw new Error('react-native-mmkv failed to load', { cause: error });
    }

    const mmkv = new MMKV();

    return {
        getString: (key) => {
            try {
                return mmkv.getString(key);
            } catch (error) {
                console.warn('[storage] MMKV getString failed', error);
                return undefined;
            }
        },
        set: (key, value) => {
            try {
                mmkv.set(key, value);
            } catch (error) {
                console.warn('[storage] MMKV set failed', error);
            }
        },
        delete: (key) => {
            try {
                mmkv.delete(key);
            } catch (error) {
                console.warn('[storage] MMKV delete failed', error);
            }
        },
        remove: (key) => {
            try {
                mmkv.delete(key);
            } catch (error) {
                console.warn('[storage] MMKV delete failed', error);
            }
        },
    };
}

function createNativeStorage(): AppStorage {
    if (useSafeNativeShims) {
        console.log('[storage] Expo Go / safe mode — using in-memory storage');
        return createMemoryStorage();
    }

    try {
        const storage = createMmkvStorage();
        console.log('[storage] Using MMKV');
        return storage;
    } catch (error) {
        console.warn('[storage] MMKV unavailable, using in-memory storage', error);
        return createMemoryStorage();
    }
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
