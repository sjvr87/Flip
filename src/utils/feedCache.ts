import type { QueryClient } from '@tanstack/react-query';

import { postToFlipItem } from '@/atproto/adapters';
import { getAgent } from '@/atproto/agent';
import type { FlipFeedPage, FlipVideo } from '@/atproto/types';

/** For You — refresh sooner so reopen feels algorithmically fresh. */
export const FEED_FYP_STALE_MS = 6_000;
/** Following — timeline can stay warm longer; soft refresh is non-destructive. */
export const FEED_FOLLOWING_STALE_MS = 12_000;
/** Local / discovery — refetch on tab focus so content rotates. */
export const FEED_LOCAL_STALE_MS = 12_000;
export const FEED_GC_MS = 2 * 60_000;

/** Single-page discovery fetch size (generators + searchPosts). */
export const DISCOVERY_SEARCH_LIMIT = 30;
/** Timeline chain depth for Following only. */
export const FOLLOWING_MAX_CHAIN_FETCHES = 12;
/** Discovery tabs — chain pages until enough non-follow videos. */
export const DISCOVERY_MAX_CHAIN_FETCHES = 10;
/** Minimum non-followed authors per discovery page when possible. */
export const DISCOVERY_MIN_NON_FOLLOW_VIDEOS = 4;

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
            return 3_000;
        case 'following':
            return 20_000;
        default:
            return 6_000;
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

/** Hard refresh: drop cached pages so the next fetch starts at cursor null
 * with a new feed epoch (caller bumps epoch in query key).
 */
export function hardRefreshFeed(queryClient: QueryClient, tab: string) {
    resetSessionSeen(tab);
    queryClient.removeQueries({ queryKey: ['videos', tab], exact: false });
}

type InfiniteProfileCache = {
    pages?: FlipFeedPage[];
    pageParams?: unknown[];
};

const pendingProfilePosts = new Map<string, { item: FlipVideo; isPhoto: boolean }>();

/** Optimistic grid entries survive server refetch until the post appears in author feed. */
export function registerPendingProfilePost(item: FlipVideo, isPhoto: boolean) {
    pendingProfilePosts.set(item.id, { item, isPhoto });
}

export function reconcilePendingProfilePosts(
    serverItems: FlipVideo[],
    isPhoto: boolean,
): FlipVideo[] {
    const serverIds = new Set(serverItems.map((entry) => entry.id));
    for (const id of serverIds) {
        const pending = pendingProfilePosts.get(id);
        if (pending?.isPhoto === isPhoto) {
            pendingProfilePosts.delete(id);
        }
    }

    const optimistic = [...pendingProfilePosts.values()]
        .filter((entry) => entry.isPhoto === isPhoto)
        .map((entry) => entry.item)
        .filter((entry) => !serverIds.has(entry.id));

    if (optimistic.length === 0) {
        return serverItems;
    }

    const merged = [...optimistic];
    for (const entry of serverItems) {
        if (!merged.some((item) => item.id === entry.id)) {
            merged.push(entry);
        }
    }
    return merged;
}

function prependToProfileMediaCache(
    queryClient: QueryClient,
    queryKeyRoot: 'userSelfPhotos' | 'userSelfVideos',
    item: FlipVideo,
) {
    queryClient.setQueriesData<InfiniteProfileCache>(
        { queryKey: [queryKeyRoot], exact: false },
        (old) => {
            const emptyPage: FlipFeedPage = {
                data: [item],
                meta: { path: 'atproto', per_page: 1, next_cursor: null },
            };

            if (!old?.pages?.length) {
                return { pages: [emptyPage], pageParams: [undefined] };
            }

            const [firstPage, ...rest] = old.pages;
            const existing = firstPage?.data ?? [];
            if (existing.some((entry) => entry.id === item.id)) {
                return old;
            }

            return {
                ...old,
                pages: [{ ...firstPage, data: [item, ...existing] }, ...rest],
            };
        },
    );
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Hydrate a freshly posted item from the App View (brief retry for indexing lag). */
export async function hydratePostedMediaItem(
    uri: string,
    attempts = 3,
): Promise<FlipVideo | null> {
    const agent = getAgent();

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const res = await agent.getPosts({ uris: [uri] });
            const post = res.data.posts[0];
            if (post && !('error' in post)) {
                const item = postToFlipItem({ post, reply: undefined }, { forceOwner: true });
                if (item) return item;
            }
        } catch {
            // retry
        }

        if (attempt < attempts - 1) {
            await sleep(350);
        }
    }

    return null;
}

function buildLocalPostedMediaItem(options: {
    uri: string;
    cid: string;
    isPhoto: boolean;
    localMediaUri: string;
    caption: string;
}): FlipVideo | null {
    const agent = getAgent();
    const did = agent.session?.did;
    const handle = agent.session?.handle;
    if (!did || !handle) return null;

    const username = handle.includes('.') ? handle.split('.')[0] : handle;
    const uriSuffix = options.uri.split('/').pop() ?? '';
    const mediaUri = options.localMediaUri.startsWith('file://')
        ? options.localMediaUri
        : `file://${options.localMediaUri}`;

    return {
        id: options.uri,
        cid: options.cid,
        account: {
            id: did,
            name: handle,
            avatar: '',
            username,
            url: `https://bsky.app/profile/${handle}`,
        },
        caption: options.caption,
        url: `https://bsky.app/profile/${handle}/post/${uriSuffix}`,
        is_owner: true,
        is_sensitive: false,
        is_photo: options.isPhoto,
        media_type: options.isPhoto ? 'photo' : 'video',
        media: {
            width: options.isPhoto ? 1 : 9,
            height: options.isPhoto ? 1 : 16,
            thumbnail: mediaUri,
            src_url: mediaUri,
            duration: 0,
        },
        likes: 0,
        shares: 0,
        comments: 0,
        bookmarks: 0,
        has_liked: false,
        has_bookmarked: false,
        has_reposted: false,
        created_at: new Date().toISOString(),
    };
}

/** Show a new post in the profile grid immediately, then let refetch reconcile. */
export async function prependPostedMediaToProfile(
    queryClient: QueryClient,
    options: {
        uri: string;
        cid: string;
        isPhoto: boolean;
        localMediaUri: string;
        caption?: string;
    },
) {
    const hydrated =
        (await hydratePostedMediaItem(options.uri)) ??
        buildLocalPostedMediaItem({
            uri: options.uri,
            cid: options.cid,
            isPhoto: options.isPhoto,
            localMediaUri: options.localMediaUri,
            caption: options.caption ?? '',
        });

    const localFallback = buildLocalPostedMediaItem({
        uri: options.uri,
        cid: options.cid,
        isPhoto: options.isPhoto,
        localMediaUri: options.localMediaUri,
        caption: options.caption ?? '',
    });

    let item = hydrated ?? localFallback;
    if (options.isPhoto && localFallback) {
        item = {
            ...(item ?? localFallback),
            is_photo: true,
            media_type: 'photo',
            media: {
                ...(item?.media ?? localFallback.media),
                thumbnail: localFallback.media.thumbnail,
                src_url: localFallback.media.src_url,
            },
        };
    }

    if (!item) return;

    registerPendingProfilePost(item, options.isPhoto);

    const queryKeyRoot = options.isPhoto ? 'userSelfPhotos' : 'userSelfVideos';
    prependToProfileMediaCache(queryClient, queryKeyRoot, item);
}

/** After a new post: trim pagination, invalidate feeds, keep profile grid prepend intact. */
export async function invalidateFeedAfterPost(queryClient: QueryClient) {
    for (const tab of FEED_TABS) {
        trimFeedToFirstPage(queryClient, tab);
    }

    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['videos'] }),
        queryClient.invalidateQueries({ queryKey: ['userVideos'] }),
        queryClient.invalidateQueries({ queryKey: ['fetchSelfAccount', 'self'] }),
        // Do not invalidate userSelfPhotos / userSelfVideos — optimistic prepend must survive.
    ]);

    await Promise.all([
        queryClient.refetchQueries({ queryKey: ['videos', 'following'] }),
        queryClient.refetchQueries({ queryKey: ['videos', 'local'] }),
    ]);
}
