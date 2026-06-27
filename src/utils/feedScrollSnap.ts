/** Snap feed scroll — one video per light flick; multi-skip only on hard swipes. */

function clampIndex(index: number, maxIndex: number): number {
    return Math.min(maxIndex, Math.max(0, index));
}

export function isRigorousFeedSwipe(
    offsetY: number,
    feedHeight: number,
    velocityY: number | undefined,
    startIndex: number,
): boolean {
    if (feedHeight <= 0) {
        return false;
    }
    const vel = velocityY ?? 0;
    const dragRatio = (offsetY - startIndex * feedHeight) / feedHeight;
    return Math.abs(vel) >= 2.75 && Math.abs(dragRatio) >= 0.2;
}

/**
 * @param startIndex Index when the user began this gesture (onScrollBeginDrag).
 */
export function resolveFeedSnapIndex(
    offsetY: number,
    feedHeight: number,
    velocityY: number | undefined,
    itemCount: number,
    startIndex: number,
): number {
    const maxIndex = Math.max(0, itemCount - 1);
    if (feedHeight <= 0 || itemCount <= 0) {
        return 0;
    }

    const vel = velocityY ?? 0;
    const startOffset = startIndex * feedHeight;
    const dragPx = offsetY - startOffset;
    const dragRatio = dragPx / feedHeight;

    if (isRigorousFeedSwipe(offsetY, feedHeight, velocityY, startIndex)) {
        const jump = Math.min(
            5,
            Math.max(3, Math.max(Math.round(Math.abs(vel) * 0.85), Math.round(Math.abs(dragRatio)))),
        );
        const dir = vel > 0 ? 1 : dragRatio > 0 ? 1 : -1;
        return clampIndex(startIndex + dir * jump, maxIndex);
    }

    // Light flick: exactly one video from where the gesture started.
    const COMMIT_RATIO = 0.22;
    const FLICK_VEL = 0.35;

    let delta = 0;
    if (dragRatio >= COMMIT_RATIO || vel >= FLICK_VEL) {
        delta = 1;
    } else if (dragRatio <= -COMMIT_RATIO || vel <= -FLICK_VEL) {
        delta = -1;
    }

    return clampIndex(startIndex + delta, maxIndex);
}

/** Nearest full-page index for paging alignment nudge. */
export function nearestFeedSnapIndex(offsetY: number, feedHeight: number, itemCount: number): number {
    const maxIndex = Math.max(0, itemCount - 1);
    if (feedHeight <= 0 || itemCount <= 0) {
        return 0;
    }
    return clampIndex(Math.round(offsetY / feedHeight), maxIndex);
}
