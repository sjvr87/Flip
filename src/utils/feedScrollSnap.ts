import { Platform } from 'react-native';

/** Snap feed scroll — one video per light flick; multi-skip only on hard swipes. */

function clampIndex(index: number, maxIndex: number): number {
    return Math.min(maxIndex, Math.max(0, index));
}

/** Android FlatList often reports lower velocity at momentum end — use release velocity. */
export function effectiveFeedSwipeVelocity(
    momentumVelocityY: number | undefined,
    releaseVelocityY: number | undefined,
): number {
    const momentum = momentumVelocityY ?? 0;
    const release = releaseVelocityY ?? 0;
    if (Math.abs(momentum) >= 0.25) {
        return momentum;
    }
    return release;
}

const RIGOROUS =
    Platform.OS === 'android'
        ? {
              minVel: 1.35,
              minDragRatio: 0.42,
              dragVel: 0.75,
              minDragForVel: 0.1,
          }
        : {
              minVel: 2.1,
              minDragRatio: 0.55,
              dragVel: 1.2,
              minDragForVel: 0.15,
          };

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
    if (Math.abs(dragRatio) >= RIGOROUS.minDragRatio && Math.abs(vel) >= RIGOROUS.dragVel) {
        return true;
    }
    return Math.abs(vel) >= RIGOROUS.minVel && Math.abs(dragRatio) >= RIGOROUS.minDragForVel;
}

/**
 * @param startIndex Index when the user began this gesture (onScrollBeginDrag).
 * @param releaseVelocityY Velocity from onScrollEndDrag when momentum end reports ~0.
 */
export function resolveFeedSnapIndex(
    offsetY: number,
    feedHeight: number,
    velocityY: number | undefined,
    itemCount: number,
    startIndex: number,
    releaseVelocityY?: number | undefined,
): number {
    const maxIndex = Math.max(0, itemCount - 1);
    if (feedHeight <= 0 || itemCount <= 0) {
        return 0;
    }

    const vel = effectiveFeedSwipeVelocity(velocityY, releaseVelocityY);
    const startOffset = startIndex * feedHeight;
    const dragPx = offsetY - startOffset;
    const dragRatio = dragPx / feedHeight;

    if (isRigorousFeedSwipe(offsetY, feedHeight, vel, startIndex)) {
        const jump = Math.min(
            5,
            Math.max(
                2,
                Math.max(Math.round(Math.abs(dragRatio)), Math.round(Math.abs(vel) * 0.85)),
            ),
        );
        const dir = vel > 0.05 ? 1 : vel < -0.05 ? -1 : dragRatio > 0 ? 1 : -1;
        return clampIndex(startIndex + dir * jump, maxIndex);
    }

    // Light flick: exactly one video from where the gesture started.
    const COMMIT_RATIO = Platform.OS === 'android' ? 0.18 : 0.22;
    const FLICK_VEL = Platform.OS === 'android' ? 0.28 : 0.35;

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
