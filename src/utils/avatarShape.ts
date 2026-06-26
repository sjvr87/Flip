/**
 * Squircle corner radius for profile avatars.
 * Matches feed action rail: 48px wide → 14px radius (~29% of size).
 */
export function squircleRadius(size: number): number {
    return Math.max(4, Math.round(size * (14 / 48)));
}

/** Common avatar footprints used across Flip. */
export const AVATAR_SIZE = {
    /** Explore text-post row */
    explore: 36,
    /** Comments / compact rows */
    comment: 32,
    /** Suggested accounts row */
    suggested: 44,
    /** Inbox, activity, followers */
    row: 48,
    /** Follower / following lists */
    list: 60,
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
