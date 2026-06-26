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

export function squircleStyle(size: number) {
    const radius = squircleRadius(size);
    return {
        width: size,
        height: size,
        borderRadius: radius,
    } as const;
}
