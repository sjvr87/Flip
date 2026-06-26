/** Snap feed scroll — one video per light flick; multi-skip only on hard swipes. */

function clampIndex(index: number, maxIndex: number): number {
    return Math.min(maxIndex, Math.max(0, index));
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

    // Hard long swipe only — needs speed AND distance (not a casual flick).
    const isRigorousSwipe =
        Math.abs(vel) >= 2.75 && Math.abs(dragRatio) >= 0.2;

    if (isRigorousSwipe) {
        const jump = Math.min(5, Math.max(3, Math.round(Math.abs(vel) * 0.85)));
        const dir = vel > 0 ? 1 : -1;
        return clampIndex(startIndex + dir * jump, maxIndex);
    }

    // Soft swipe: position-first (past halfway commits), velocity can commit a flick early.
    // Never mix opposing position + velocity — that caused half-swipe pull-back.
    const COMMIT_RATIO = 0.45;
    const FLICK_VEL = 0.32;

    let delta = 0;
    if (dragRatio >= COMMIT_RATIO) {
        delta = 1;
    } else if (dragRatio <= -COMMIT_RATIO) {
        delta = -1;
    } else if (vel >= FLICK_VEL) {
        delta = 1;
    } else if (vel <= -FLICK_VEL) {
        delta = -1;
    }

    return clampIndex(startIndex + delta, maxIndex);
}
