import type { FlipFeedPage, FlipTextPost } from '@/atproto/types';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { Storage } from '@/utils/cache';

function safeCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Explore tab — warm cache so revisits feel instant. */
export const EXPLORE_STALE_MS = 10 * 60_000;
export const EXPLORE_GC_MS = 20 * 60_000;

/** First page size for tag video grid (3 columns × 4 rows). */
export const EXPLORE_FEED_PAGE_SIZE = 12;

/** First paint — one searchPosts call only; pagination fetches one page at a time. */
export const EXPLORE_MAX_EMPTY_FETCHES = 1;

/** Seed tag for video grid until user picks a trending tag. */
export const EXPLORE_DEFAULT_TAG = 'flip';

export const EXPLORE_TAGS_LIMIT = 8;
export const EXPLORE_ACCOUNTS_LIMIT = 10;

/** Text-only posts shown in Explore header carousel. */
export const EXPLORE_TEXT_POSTS_PAGE_SIZE = 12;
export const EXPLORE_TEXT_CHAIN_FETCHES = 4;

const CACHE_PREFIX = 'explore.cache.';

export type ExploreTagCache = {
    id: number;
    name: string;
    count: number;
};

export type ExploreAccountCache = {
    id: string;
    name: string;
    avatar: string;
    username: string;
    bio: string;
    follower_count: number;
    post_count?: number;
};

type ExploreFeedCache = {
    pages: FlipFeedPage[];
    pageParams: (string | false | null)[];
};

function readJson<T>(key: string): T | undefined {
    const raw = Storage.getString(key);
    if (!raw) return undefined;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

function writeJson(key: string, value: unknown): void {
    try {
        Storage.set(key, JSON.stringify(value));
    } catch {
        // Best-effort warm cache — never block Explore.
    }
}

export function readExploreTagsCache(): ExploreTagCache[] | undefined {
    const data = readJson<ExploreTagCache[]>(`${CACHE_PREFIX}tags`);
    return Array.isArray(data) && data.length > 0 ? data : undefined;
}

export function writeExploreTagsCache(tags: ExploreTagCache[]): void {
    writeJson(`${CACHE_PREFIX}tags`, tags);
}

export function readExploreAccountsCache(): ExploreAccountCache[] | undefined {
    const data = readJson<ExploreAccountCache[]>(`${CACHE_PREFIX}accounts`);
    return Array.isArray(data) && data.length > 0 ? data : undefined;
}

export function writeExploreAccountsCache(accounts: ExploreAccountCache[]): void {
    writeJson(`${CACHE_PREFIX}accounts`, accounts);
}

export function readExploreFeedCache(tag: string): ExploreFeedCache | undefined {
    const safeTag = tag.replace(/^#/, '').toLowerCase();
    const data = readJson<ExploreFeedCache>(`${CACHE_PREFIX}feed.${safeTag}`);
    if (!data?.pages?.length) return undefined;
    return data;
}

export function writeExploreFeedCache(
    tag: string,
    pages: FlipFeedPage[],
    pageParams: (string | false | null)[],
): void {
    const safeTag = tag.replace(/^#/, '').toLowerCase();
    writeJson(`${CACHE_PREFIX}feed.${safeTag}`, { pages, pageParams });
}

type ExploreTextPostsCache = {
    pages: {
        data: FlipTextPost[];
        meta: { path: string; per_page: number; next_cursor: string | null };
    }[];
    pageParams: (string | false | null)[];
};

export function readExploreTextPostsCache(): ExploreTextPostsCache | undefined {
    const data = readJson<ExploreTextPostsCache>(`${CACHE_PREFIX}text-posts`);
    if (!data?.pages?.length) return undefined;
    return data;
}

export function writeExploreTextPostsCache(
    pages: ExploreTextPostsCache['pages'],
    pageParams: (string | false | null)[],
): void {
    writeJson(`${CACHE_PREFIX}text-posts`, { pages, pageParams });
}

export type ExploreTextPostsInfiniteData = InfiniteData<
    { data: FlipTextPost[]; meta: { path: string; per_page: number; next_cursor: string | null } },
    string | false | null
>;

export function patchExploreTextPost(
    queryClient: QueryClient,
    postId: string,
    updater: (post: FlipTextPost) => FlipTextPost,
): void {
    queryClient.setQueriesData<ExploreTextPostsInfiniteData>(
        { queryKey: ['explore', 'text-posts'] },
        (old) => {
            if (!old?.pages?.length) return old;

            let changed = false;
            const next: ExploreTextPostsInfiniteData = {
                ...old,
                pages: old.pages.map((page) => ({
                    ...page,
                    data: (page.data ?? []).map((post) => {
                        if (post.id !== postId) return post;
                        const updated = updater(post);
                        if (updated !== post) changed = true;
                        return updated;
                    }),
                })),
            };

            if (changed) {
                queueMicrotask(() => writeExploreTextPostsCache(next.pages, next.pageParams));
            }

            return changed ? next : old;
        },
    );
}

/** Optimistically sync like state for Explore "From the network" carousel cards. */
export function patchExploreTextPostLike(
    queryClient: QueryClient,
    postId: string,
    liked: boolean,
    likes?: number,
): void {
    patchExploreTextPost(queryClient, postId, (post) => {
        if (typeof likes === 'number' && Number.isFinite(likes)) {
            if (post.has_liked === liked && post.likes === likes) return post;
            return { ...post, has_liked: liked, likes };
        }

        const wasLiked = !!post.has_liked;
        if (wasLiked === liked) return post;

        return {
            ...post,
            has_liked: liked,
            likes: Math.max(0, safeCount(post.likes) + (liked ? 1 : -1)),
        };
    });
}

/** Optimistically sync bookmark state for Explore "From the network" carousel cards. */
export function patchExploreTextPostBookmark(
    queryClient: QueryClient,
    postId: string,
    bookmarked: boolean,
    bookmarks?: number,
): void {
    patchExploreTextPost(queryClient, postId, (post) => {
        if (typeof bookmarks === 'number' && Number.isFinite(bookmarks)) {
            if (post.has_bookmarked === bookmarked && post.bookmarks === bookmarks) return post;
            return { ...post, has_bookmarked: bookmarked, bookmarks };
        }

        const wasBookmarked = !!post.has_bookmarked;
        if (wasBookmarked === bookmarked) return post;

        return {
            ...post,
            has_bookmarked: bookmarked,
            bookmarks: Math.max(0, safeCount(post.bookmarks) + (bookmarked ? 1 : -1)),
        };
    });
}

/** Optimistically sync repost state for Explore "From the network" carousel cards. */
export function patchExploreTextPostRepost(
    queryClient: QueryClient,
    postId: string,
    reposted: boolean,
    reposts?: number,
): void {
    patchExploreTextPost(queryClient, postId, (post) => {
        if (typeof reposts === 'number' && Number.isFinite(reposts)) {
            if (post.has_reposted === reposted && post.reposts === reposts) return post;
            return { ...post, has_reposted: reposted, reposts };
        }

        const wasReposted = !!post.has_reposted;
        if (wasReposted === reposted) return post;

        return {
            ...post,
            has_reposted: reposted,
            reposts: Math.max(0, safeCount(post.reposts) + (reposted ? 1 : -1)),
        };
    });
}
