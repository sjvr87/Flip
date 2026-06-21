import { getExploreAccounts, getExploreTags, getExploreTagsFeed } from '@/atproto';
import type { QueryClient } from '@tanstack/react-query';

import {
    EXPLORE_DEFAULT_TAG,
    EXPLORE_GC_MS,
    EXPLORE_STALE_MS,
    writeExploreAccountsCache,
    writeExploreTagsCache,
} from './exploreCache';
import { prefetchThumbnails } from './thumbnailPrefetch';

const exploreQueryOptions = {
    staleTime: EXPLORE_STALE_MS,
    gcTime: EXPLORE_GC_MS,
    refetchOnWindowFocus: false,
};

let prefetchStarted = false;

/** Warm React Query cache for Explore while user is on Home — tab switch feels instant. */
export function prefetchExploreQueries(queryClient: QueryClient): void {
    if (prefetchStarted) return;
    prefetchStarted = true;

    void (async () => {
        try {
            const [, accounts, feed] = await Promise.all([
                queryClient.fetchQuery({
                    queryKey: ['explore', 'tags'],
                    queryFn: async () => {
                        const data = await getExploreTags();
                        writeExploreTagsCache(data);
                        return data;
                    },
                    ...exploreQueryOptions,
                }),
                queryClient.fetchQuery({
                    queryKey: ['accounts', 'suggested'],
                    queryFn: async () => {
                        const data = await getExploreAccounts();
                        writeExploreAccountsCache(data);
                        return data;
                    },
                    ...exploreQueryOptions,
                }),
                queryClient.fetchInfiniteQuery({
                    queryKey: ['explore', 'tag-feed', EXPLORE_DEFAULT_TAG],
                    queryFn: (context) =>
                        getExploreTagsFeed({
                            queryKey: context.queryKey,
                            pageParam: context.pageParam ?? undefined,
                        }),
                    initialPageParam: null,
                    ...exploreQueryOptions,
                }),
            ]);

            prefetchThumbnails([
                ...accounts.map((account) => account.avatar),
                ...feed.pages.flatMap((page) =>
                    (page.data ?? []).map((video) => video.media?.thumbnail),
                ),
            ]);
        } catch {
            // Best-effort background warm — Explore screen still fetches on focus.
        }
    })();
}
