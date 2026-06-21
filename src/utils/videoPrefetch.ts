import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { Platform } from 'react-native';

/** Disabled on Android — prefetch players SIGSEGV Hermes on Samsung / Android 17 beta. */
const prefetchEnabled = Platform.OS !== 'android';

/** Keep low — each player holds ExoPlayer + Hermes event listeners (OOM/SIGSEGV on Samsung). */
const MAX_PREFETCH_PLAYERS = 2;
const prefetched = new Map<string, VideoPlayer>();

function releasePrefetch(url: string) {
    const player = prefetched.get(url);
    if (!player) {
        return;
    }
    try {
        player.release?.();
    } catch {
        // player may already be released
    }
    prefetched.delete(url);
}

function trimPrefetchCache() {
    while (prefetched.size > MAX_PREFETCH_PLAYERS) {
        const oldest = prefetched.keys().next().value;
        if (!oldest) {
            break;
        }
        releasePrefetch(oldest);
    }
}

/** Take a warmed player for the active slide (removed from prefetch cache). */
export function takePrefetchedPlayer(url: string | undefined | null): VideoPlayer | null {
    if (!url) {
        return null;
    }
    const player = prefetched.get(url);
    if (!player) {
        return null;
    }
    prefetched.delete(url);
    return player;
}

/** Warm HLS cache for a URL without mounting a visible VideoPlayer. */
export async function prefetchVideoUrl(url: string | undefined | null): Promise<void> {
    if (!prefetchEnabled || !url || prefetched.has(url)) {
        return;
    }

    try {
        const player = createVideoPlayer(url);
        player.muted = true;
        prefetched.set(url, player);
        trimPrefetchCache();
        // replaceAsync warms the HLS manifest only — play()/pause() races EventEmitter
        // callbacks and SIGSEGVs Hermes when the player is transferred or released.
        await player.replaceAsync(url);
    } catch {
        releasePrefetch(url);
    }
}

export function prefetchVideoUrls(urls: (string | undefined | null)[]): void {
    if (!prefetchEnabled) {
        return;
    }
    for (const url of urls) {
        void prefetchVideoUrl(url);
    }
}

export function releaseAllVideoPrefetch(): void {
    for (const url of [...prefetched.keys()]) {
        releasePrefetch(url);
    }
}
