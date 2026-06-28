import { Platform } from 'react-native';

/** Snap feed scroll — one video per light flick; multi-skip only on hard swipes. */

function clampIndex(index: number, maxIndex: number): number {
    return Math.min(maxIndex, Math.max(0, index));
}

/**
 * RN vertical scroll: finger up / next video increases contentOffset.y.
 * Velocity.y is negative on Android (and typically iOS) for that direction.
 */
export function feedScrollDirection(dragRatio: number, velocityY: number | undefined): -1 | 0 | 1 {
    if (dragRatio > 0.06) {
        return 1;
    }
    if (dragRatio < -0.06) {
        return -1;
    }
    const vel = velocityY ?? 0;
    if (Math.abs(vel) < 0.08) {
        return 0;
    }
    return vel < 0 ? 1 : -1;
}

/** Android FlatList often reports ~0 velocity at momentum end — use release velocity. */
export function effectiveFeedSwipeVelocity(
    momentumVelocityY: number | undefined,
    releaseVelocityY: number | undefined,
): number {
    const momentum = momentumVelocityY ?? 0;
    const release = releaseVelocityY ?? 0;
    if (Math.abs(momentum) >= 0.2) {
        return momentum;
    }
    return release;
}

const RIGOROUS =
    Platform.OS === 'android'
        ? {
              minVel: 1.2,
              minDragRatio: 0.38,
              dragVel: 0.65,
              minDragForVel: 0.08,
          }
        : {
              minVel: 2.0,
              minDragRatio: 0.5,
              dragVel: 1.0,
              minDragForVel: 0.12,
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
    const dragRatio = (offsetY - startOffset) / feedHeight;

    if (isRigorousFeedSwipe(offsetY, feedHeight, vel, startIndex)) {
        const jump = Math.min(
            5,
            Math.max(
                2,
                Math.max(Math.round(Math.abs(dragRatio)), Math.round(Math.abs(vel) * 0.85)),
            ),
        );
        const dir = feedScrollDirection(dragRatio, vel) || (dragRatio >= 0 ? 1 : -1);
        return clampIndex(startIndex + dir * jump, maxIndex);
    }

    // Light swipe: exactly one video from gesture start (or stay).
    const COMMIT_RATIO = Platform.OS === 'android' ? 0.16 : 0.2;
    const FLICK_VEL = Platform.OS === 'android' ? 0.22 : 0.3;

    let delta = 0;
    const dir = feedScrollDirection(dragRatio, vel);
    if (dir !== 0) {
        if (Math.abs(dragRatio) >= COMMIT_RATIO || Math.abs(vel) >= FLICK_VEL) {
            delta = dir;
        }
    }

    if (delta === 0 && Math.abs(dragRatio) >= 0.45) {
        delta = dragRatio > 0 ? 1 : -1;
    }

    if (delta === 0) {
        const nearest = nearestFeedSnapIndex(offsetY, feedHeight, itemCount);
        if (nearest !== startIndex && Math.abs(dragRatio) >= 0.38) {
            delta = nearest > startIndex ? 1 : -1;
        }
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
