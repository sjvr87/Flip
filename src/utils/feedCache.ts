import type { QueryClient } from '@tanstack/react-query';

import type { FlipVideo } from '@/atproto/types';

/** For You — refresh sooner so reopen feels algorithmically fresh. */
export const FEED_FYP_STALE_MS = 12_000;
/** Following — timeline can stay warm longer; soft refresh is non-destructive. */
export const FEED_FOLLOWING_STALE_MS = 20_000;
export const FEED_LOCAL_STALE_MS = 25_000;
export const FEED_GC_MS = 3 * 60_000;

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
            return 6_000;
        case 'following':
            return 45_000;
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
    queryClient.setQueryData(['videos', tab], (old: { pages?: unknown[]; pageParams?: unknown[] } | undefined) => {
        if (!old?.pages?.length) {
            return old;
        }
        return {
            pages: old.pages.slice(0, 1),
            pageParams: old.pageParams!.slice(0, 1),
        };
    });
}

/** Soft refresh: refetch page 0 only — keeps scrolled pagination intact. */
export function softRefreshFeed(queryClient: QueryClient, tab: string) {
    void queryClient.refetchQueries({
        queryKey: ['videos', tab],
        type: 'active',
        refetchPage: (_page, index) => index === 0,
    });
}

/** Hard refresh: trim to first page then refetch (cold open / pull refresh). */
export function hardRefreshFeed(queryClient: QueryClient, tab: string) {
    resetSessionSeen(tab);
    trimFeedToFirstPage(queryClient, tab);
    void queryClient.refetchQueries({
        queryKey: ['videos', tab],
        type: 'active',
    });
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
