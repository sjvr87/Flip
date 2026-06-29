/** Proportional squircle corner radius — matches feed action rail (14px @ 48px). */
export const SQUIRCLE_RADIUS_RATIO = 14 / 48;

export function squircleRadiusForSize(size: number): number {
    return Math.round(size * SQUIRCLE_RADIUS_RATIO);
}

/** Feed action rail — largest squircle avatar in the app. */
export const FEED_AVATAR_SIZE = 54;
export const FEED_AVATAR_RADIUS = squircleRadiusForSize(FEED_AVATAR_SIZE);
export const FEED_AVATAR_INNER = FEED_AVATAR_SIZE + 6;
export const FEED_AVATAR_RING = FEED_AVATAR_INNER + 4;
