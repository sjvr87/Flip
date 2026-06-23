import type { VideoSource } from 'expo-video';

/** Bluesky / Flip feed URLs are HLS playlists; explicit contentType avoids iOS track sniffing delays. */
export function isHlsFeedUrl(url: string): boolean {
    return url.includes('.m3u8') || url.includes('/playlist/') || url.includes('playlist');
}

export function buildFeedVideoSource(url: string | undefined | null): VideoSource {
    const trimmed = url?.trim();
    if (!trimmed) {
        return null;
    }
    if (isHlsFeedUrl(trimmed)) {
        return { uri: trimmed, contentType: 'hls' };
    }
    return trimmed;
}
