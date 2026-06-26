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

    const ONE_VIDEO_DRAG = 0.14;
    const ONE_VIDEO_VEL = 0.55;

    const wantsNext = dragRatio > ONE_VIDEO_DRAG || vel > ONE_VIDEO_VEL;
    const wantsPrev = dragRatio < -ONE_VIDEO_DRAG || vel < -ONE_VIDEO_VEL;

    if (wantsNext && !wantsPrev) {
        return clampIndex(startIndex + 1, maxIndex);
    }
    if (wantsPrev && !wantsNext) {
        return clampIndex(startIndex - 1, maxIndex);
    }

    return clampIndex(startIndex, maxIndex);
}
