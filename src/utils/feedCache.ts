import type { QueryClient } from '@tanstack/react-query';

import type { FlipVideo } from '@/atproto/types';

/** For You — refresh sooner so reopen feels algorithmically fresh. */
export const FEED_FYP_STALE_MS = 8_000;
/** Following — timeline can stay warm longer; soft refresh is non-destructive. */
export const FEED_FOLLOWING_STALE_MS = 15_000;
/** Local / discovery — warm longer so tab switches feel instant (like Explore). */
export const FEED_LOCAL_STALE_MS = 60_000;
export const FEED_GC_MS = 2 * 60_000;

/** Single-page discovery fetch size (generators + searchPosts). */
export const DISCOVERY_SEARCH_LIMIT = 30;
/** Timeline chain depth for Following only. */
export const FOLLOWING_MAX_CHAIN_FETCHES = 8;

export const FEED_TABS = ['following', 'local', 'forYou'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

const sessionSeenByTab = new Map<string, Set<string>>();

function getSessionSeen(tab: string): Set<string> {
    let seen = sessionSeenByTab.get(tab);
    if (!seen) {
        seen = new Set<string>();
        sessionSeenByTab.set(tab, seen);
    }
    return seen;
}

/** Clear session dedupe for a tab (pull-to-refresh / hard refresh). */
export function resetSessionSeen(tab: string) {
    sessionSeenByTab.set(tab, new Set());
}

export function getFeedStaleMs(tab: string): number {
    switch (tab) {
        case 'forYou':
            return FEED_FYP_STALE_MS;
        case 'following':
            return FEED_FOLLOWING_STALE_MS;
        default:
            return FEED_LOCAL_STALE_MS;
    }
}

/** Soft refresh thresholds — FYP aggressive, Following gentle (page-0 only). */
export function getFeedSoftRefreshMs(tab: string): number {
    switch (tab) {
        case 'forYou':
            return 4_000;
        case 'following':
            return 30_000;
        default:
            return FEED_LOCAL_STALE_MS / 2;
    }
}

/** Stable key for cross-page dedupe (reposts share CID / playlist URL). */
export function videoDedupeKey(video: FlipVideo): string | null {
    if (video.cid) {
        return `cid:${video.cid}`;
    }
    if (video.id) {
        return `id:${video.id}`;
    }
    const src = video.media?.src_url;
    if (src) {
        return `src:${src}`;
    }
    return null;
}

/** Deterministic shuffle — same seed yields same order within a session page. */
export function shuffleFeedVideos(videos: FlipVideo[], seed: number): FlipVideo[] {
    if (videos.length <= 1 || seed === 0) {
        return videos;
    }
    const arr = [...videos];
    let state = (seed >>> 0) || 1;
    const rand = () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Flatten infinite-query pages: drop cross-page duplicates (reposts, overlaps).
 * Session seen is tracked for refresh boundaries only — not removed from the
 * visible list while scrolling (removing watched items caused list shrink + refetch storms).
 */
export function dedupeFeedVideos(videos: FlipVideo[], _tab?: string): FlipVideo[] {
    const pageSeen = new Set<string>();
    const result: FlipVideo[] = [];

    for (const video of videos) {
        const key = videoDedupeKey(video);
        if (!key || pageSeen.has(key)) {
            continue;
        }
        pageSeen.add(key);
        result.push(video);
    }

    return result;
}

/** Record a video as seen this session (used on pull-to-refresh / hard refresh boundaries). */
export function markVideoSeenInSession(tab: string, video: FlipVideo) {
    const key = videoDedupeKey(video);
    if (key) {
        getSessionSeen(tab).add(key);
    }
}

export function trimFeedToFirstPage(queryClient: QueryClient, tab: string) {
    queryClient.setQueriesData(
        { queryKey: ['videos', tab], exact: false },
        (old: { pages?: unknown[]; pageParams?: unknown[] } | undefined) => {
            if (!old?.pages?.length) {
                return old;
            }
            return {
                pages: old.pages.slice(0, 1),
                pageParams: old.pageParams!.slice(0, 1),
            };
        },
    );
}

/** Soft refresh: refetch page 0 only — keeps scrolled pagination intact. */
export function softRefreshFeed(queryClient: QueryClient, tab: string) {
    void queryClient.invalidateQueries({
        queryKey: ['videos', tab],
        refetchType: 'active',
        refetchPage: (_page, index) => index === 0,
    });
}

/**
 * Hard refresh: drop cached pages so the next fetch starts at cursor null
 * with a new feed epoch (caller bumps epoch in query key).
 */
export function hardRefreshFeed(queryClient: QueryClient, tab: string) {
    resetSessionSeen(tab);
    queryClient.removeQueries({ queryKey: ['videos', tab], exact: false });
}

/** After a new post: trim pagination, invalidate, and refetch feeds + profile. */
export async function invalidateFeedAfterPost(queryClient: QueryClient) {
    for (const tab of FEED_TABS) {
        trimFeedToFirstPage(queryClient, tab);
    }

    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['videos'] }),
        queryClient.invalidateQueries({ queryKey: ['userSelfVideos'] }),
        queryClient.invalidateQueries({ queryKey: ['fetchSelfAccount', 'self'] }),
    ]);

    await Promise.all([
        queryClient.refetchQueries({ queryKey: ['videos', 'following'] }),
        queryClient.refetchQueries({ queryKey: ['videos', 'local'] }),
        queryClient.refetchQueries({ queryKey: ['userSelfVideos'] }),
    ]);
}
