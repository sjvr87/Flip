/**
 * Squircle corner radius for profile avatars.
 * Matches feed action rail: 48px wide → 14px radius (~29% of size).
 */
export function squircleRadius(size: number): number {
    return Math.max(4, Math.round(size * (14 / 48)));
}

/** Common avatar footprints used across Flip. */
export const AVATAR_SIZE = {
    /** Tiny overlay (search video caption row) */
    micro: 20,
    /** Starter kit browse stacked avatars */
    tiny: 24,
    /** Starter kit creator chip */
    mini: 16,
    /** Comment thread replies */
    reply: 28,
    /** Comments / compact rows */
    comment: 32,
    /** Explore text-post row */
    explore: 36,
    /** Video timeline action rail */
    feed: 42,
    /** Suggested accounts row */
    suggested: 44,
    /** Inbox, activity, notifications, followers */
    row: 48,
    /** Search user rows (w-14) */
    searchRow: 56,
    /** Follower / following lists */
    list: 60,
    /** Sign-in welcome card */
    signIn: 88,
    /** Profile header */
    profile: 120,
} as const;

/** Corner badge on avatar — matches feed follow/add affordance (FeedActionRail `followBadge`). */
export const AVATAR_CORNER_BADGE_SIZE = 28;
export const AVATAR_CORNER_BADGE_OFFSET = { bottom: -14, right: -8 } as const;

/** New follower rows — same follow/add icon as video feed, nudged lower for visibility on avatars. */
export const ACTIVITY_FOLLOW_BADGE_SIZE = AVATAR_CORNER_BADGE_SIZE;
export const ACTIVITY_FOLLOW_BADGE_OFFSET = { bottom: -21, right: -6 } as const;

/** Activity comment badge — smaller, hangs off bottom-right so it covers less of the photo. */
export const ACTIVITY_COMMENT_BADGE_SIZE = 24;
export const ACTIVITY_COMMENT_BADGE_OFFSET = { bottom: -19, right: -11 } as const;

/** Activity like heart — lower/right of default, but above the comment badge. */
export const ACTIVITY_LIKE_BADGE_OFFSET = { bottom: -11, right: -7 } as const;

export function squircleStyle(size: number) {
    const radius = squircleRadius(size);
    return {
        width: size,
        height: size,
        borderRadius: radius,
    } as const;
}
