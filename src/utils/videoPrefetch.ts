import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { Platform } from 'react-native';
import { getFeedNetworkProfile } from '@/utils/feedNetworkQuality';
import { isFeedPlaybackActive } from '@/utils/feedPlaybackGuard';
import { buildFeedVideoSource } from '@/utils/feedVideoSource';

/** Disabled on Android — prefetch players SIGSEGV Hermes on Samsung / Android 17 beta. */
const prefetchEnabled = Platform.OS !== 'android';

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

function maxPrefetchPlayers(): number {
    const { prefetchAhead, tier } = getFeedNetworkProfile();
    if (tier === 'offline' || tier === 'slow') {
        return 0;
    }
    return prefetchAhead > 0 ? 1 : 0;
}

function trimPrefetchCache() {
    const max = maxPrefetchPlayers();
    while (prefetched.size > max) {
        const oldest = prefetched.keys().next().value;
        if (!oldest) {
            break;
        }
        releasePrefetch(oldest);
    }
}

function applyBufferOptions(player: VideoPlayer) {
    try {
        player.bufferOptions = getFeedNetworkProfile().bufferOptions;
    } catch {
        // non-fatal
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
    if (!prefetchEnabled || !url || !isFeedPlaybackActive()) {
        return;
    }
    if (maxPrefetchPlayers() === 0) {
        return;
    }
    if (prefetched.has(url)) {
        return;
    }

    const source = buildFeedVideoSource(url);
    if (!source) {
        return;
    }

    try {
        const player = createVideoPlayer(source);
        player.muted = true;
        applyBufferOptions(player);
        prefetched.set(url, player);
        trimPrefetchCache();
        await player.replaceAsync(source);
    } catch {
        releasePrefetch(url);
    }
}

export function prefetchVideoUrls(urls: (string | undefined | null)[]): void {
    if (!prefetchEnabled || !isFeedPlaybackActive()) {
        return;
    }
    const max = maxPrefetchPlayers();
    if (max === 0) {
        return;
    }
    let count = 0;
    for (const url of urls) {
        if (!url || prefetched.has(url)) {
            continue;
        }
        if (count >= max) {
            break;
        }
        count += 1;
        void prefetchVideoUrl(url);
    }
}

export function releaseAllVideoPrefetch(): void {
    for (const url of [...prefetched.keys()]) {
        releasePrefetch(url);
    }
}

export function cancelOffscreenPrefetch(keepUrls: Set<string>): void {
    for (const url of [...prefetched.keys()]) {
        if (!keepUrls.has(url)) {
            releasePrefetch(url);
        }
    }
}
