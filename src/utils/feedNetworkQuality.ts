import type { NetInfoState } from '@react-native-community/netinfo';
import type { BufferOptions } from 'expo-video';
import { NativeModules } from 'react-native';

type NetInfoModule = typeof import('@react-native-community/netinfo').default;

/** Lazy-load NetInfo only when the native module is linked (avoids throw on import). */
function loadNetInfo(): NetInfoModule | null {
    if (!NativeModules.RNCNetInfo) {
        return null;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('@react-native-community/netinfo').default as NetInfoModule;
        if (typeof mod?.fetch !== 'function' || typeof mod?.addEventListener !== 'function') {
            return null;
        }
        return mod;
    } catch {
        return null;
    }
}

export type FeedNetworkTier = 'wifi' | 'cellular' | 'slow' | 'offline';

export type FeedNetworkProfile = {
    tier: FeedNetworkTier;
    /** Max adjacent slides that mount a decoded player (0 = active only). */
    playerPreloadDistance: number;
    /** HLS URL prefetch count beyond the active index (0 = none). */
    prefetchAhead: number;
    bufferOptions: BufferOptions;
};

const WIFI_PROFILE: FeedNetworkProfile = {
    tier: 'wifi',
    playerPreloadDistance: 2,
    prefetchAhead: 1,
    bufferOptions: {
        preferredForwardBufferDuration: 18,
        waitsToMinimizeStalling: true,
        minBufferForPlayback: 3,
        maxBufferBytes: null,
    },
};

const CELLULAR_PROFILE: FeedNetworkProfile = {
    tier: 'cellular',
    playerPreloadDistance: 2,
    prefetchAhead: 1,
    bufferOptions: {
        preferredForwardBufferDuration: 10,
        waitsToMinimizeStalling: true,
        minBufferForPlayback: 2,
        maxBufferBytes: 24 * 1024 * 1024,
    },
};

const SLOW_PROFILE: FeedNetworkProfile = {
    tier: 'slow',
    playerPreloadDistance: 0,
    prefetchAhead: 0,
    bufferOptions: {
        preferredForwardBufferDuration: 2,
        waitsToMinimizeStalling: true,
        minBufferForPlayback: 0.5,
        maxBufferBytes: 6 * 1024 * 1024,
    },
};

const OFFLINE_PROFILE: FeedNetworkProfile = {
    tier: 'offline',
    playerPreloadDistance: 0,
    prefetchAhead: 0,
    bufferOptions: {
        preferredForwardBufferDuration: 1,
        waitsToMinimizeStalling: true,
        minBufferForPlayback: 0.5,
    },
};

function tierFromNetInfo(state: NetInfoState | null): FeedNetworkTier {
    if (!state?.isConnected || state.isInternetReachable === false) {
        return 'offline';
    }

    const type = state.type;
    if (type === 'wifi' || type === 'ethernet') {
        return 'wifi';
    }

    if (type === 'cellular') {
        const gen =
            state.details && 'cellularGeneration' in state.details
                ? state.details.cellularGeneration
                : null;
        if (gen === '2g' || gen === '3g') {
            return 'slow';
        }
        return 'cellular';
    }

    if (type === 'none' || type === 'unknown') {
        return 'slow';
    }

    return 'cellular';
}

export function profileForTier(tier: FeedNetworkTier): FeedNetworkProfile {
    switch (tier) {
        case 'wifi':
            return WIFI_PROFILE;
        case 'cellular':
            return CELLULAR_PROFILE;
        case 'slow':
            return SLOW_PROFILE;
        default:
            return OFFLINE_PROFILE;
    }
}

export function profileFromNetInfo(state: NetInfoState | null): FeedNetworkProfile {
    return profileForTier(tierFromNetInfo(state));
}

/** Simple stall heuristic — step down one tier when playback keeps rebuffering. */
export function downgradeProfile(profile: FeedNetworkProfile): FeedNetworkProfile {
    switch (profile.tier) {
        case 'wifi':
            return CELLULAR_PROFILE;
        case 'cellular':
            return SLOW_PROFILE;
        default:
            return profile;
    }
}

let currentProfile: FeedNetworkProfile = CELLULAR_PROFILE;
const listeners = new Set<(profile: FeedNetworkProfile) => void>();
let netInfoUnsub: (() => void) | null = null;

export function getFeedNetworkProfile(): FeedNetworkProfile {
    return currentProfile;
}

export function subscribeFeedNetworkProfile(
    listener: (profile: FeedNetworkProfile) => void,
): () => void {
    listeners.add(listener);
    listener(currentProfile);
    return () => listeners.delete(listener);
}

function emitProfile(profile: FeedNetworkProfile) {
    if (profile.tier === currentProfile.tier) {
        return;
    }
    currentProfile = profile;
    for (const listener of listeners) {
        listener(profile);
    }
}

/** Call once from the home feed screen. */
export function startFeedNetworkMonitoring(): () => void {
    if (netInfoUnsub) {
        return netInfoUnsub;
    }

    const NetInfo = loadNetInfo();
    if (!NetInfo) {
        if (__DEV__) {
            console.warn(
                '[feed] NetInfo native module missing — using default cellular profile. Rebuild the app after adding @react-native-community/netinfo.',
            );
        }
        return () => {};
    }

    void NetInfo.fetch()
        .then((state) => {
            emitProfile(profileFromNetInfo(state));
        })
        .catch(() => {});

    try {
        netInfoUnsub = NetInfo.addEventListener((state) => {
            emitProfile(profileFromNetInfo(state));
        });
    } catch (error) {
        if (__DEV__) {
            console.warn('[feed] NetInfo.addEventListener failed:', error);
        }
        return () => {};
    }

    return () => {
        netInfoUnsub?.();
        netInfoUnsub = null;
    };
}

/** Temporary downgrade after repeated rebuffer events on the active slide. */
export function reportFeedPlaybackStall(): void {
    emitProfile(downgradeProfile(currentProfile));
}
