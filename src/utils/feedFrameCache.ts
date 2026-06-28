/** Tracks videos that already decoded at least one frame (avoids poster flash on revisit). */
const readyBySrc = new Set<string>();

export function markFeedFrameReady(srcUrl: string | undefined | null): void {
    if (srcUrl) {
        readyBySrc.add(srcUrl);
    }
}

export function isFeedFrameReady(srcUrl: string | undefined | null): boolean {
    return !!(srcUrl && readyBySrc.has(srcUrl));
}
