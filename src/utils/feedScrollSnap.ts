/** Snap feed scroll to a single video page — tuned for TikTok-style paging. */

function clampIndex(index: number, maxIndex: number): number {
    return Math.min(maxIndex, Math.max(0, index));
}

/**
 * @param offsetY FlatList contentOffset.y
 * @param feedHeight One page height in px
 * @param velocityY Scroll velocity (y); may be undefined on some Android builds
 * @param itemCount Number of feed rows
 */
export function resolveFeedSnapIndex(
    offsetY: number,
    feedHeight: number,
    velocityY: number | undefined,
    itemCount: number,
): number {
    const maxIndex = Math.max(0, itemCount - 1);
    if (feedHeight <= 0 || itemCount <= 0) {
        return 0;
    }

    const vel = velocityY ?? 0;
    const pageFloat = offsetY / feedHeight;
    const base = Math.floor(pageFloat + 1e-4);
    const remainder = pageFloat - base;

    // Light nudge — at most one video, or snap back if barely moved.
    if (Math.abs(vel) < 0.4) {
        if (remainder < 0.1) {
            return clampIndex(base, maxIndex);
        }
        if (remainder > 0.9) {
            return clampIndex(base + 1, maxIndex);
        }
        return clampIndex(remainder >= 0.5 ? base + 1 : base, maxIndex);
    }

    // Fast long flick — skip 3–5 videos by velocity.
    if (Math.abs(vel) >= 1.5) {
        const jump = Math.min(5, Math.max(3, Math.round(Math.abs(vel) * 1.4)));
        const dir = vel > 0 ? 1 : -1;
        return clampIndex(base + dir * jump, maxIndex);
    }

    // Medium swipe — exactly one video in swipe direction.
    const dir = vel > 0 ? 1 : -1;
    return clampIndex(base + dir, maxIndex);
}
