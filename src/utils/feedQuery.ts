import {
    fetchFollowingFeed,
    fetchForYouFeed,
    fetchTrendingFeed,
} from '@/atproto';
import type { FeedTab } from '@/utils/feedCache';

export const fetchFeedTabPage = async ({
    pageParam = null,
    tab,
    refreshEpoch = 0,
}: {
    pageParam?: string | null;
    tab: FeedTab;
    refreshEpoch?: number;
}) => {
    if (tab === 'trending') {
        return await fetchTrendingFeed({ pageParam, refreshEpoch });
    }
    if (tab === 'forYou') {
        return await fetchForYouFeed({ pageParam, refreshEpoch });
    }
    return await fetchFollowingFeed({ pageParam, refreshEpoch });
};

/** Read tab + epoch from query key so refetches never use a stale activeTab closure. */
export const feedQueryFn = ({
    pageParam,
    queryKey,
}: {
    pageParam: string | null;
    queryKey: readonly unknown[];
}) => {
    const tab = queryKey[1] as FeedTab;
    const refreshEpoch = typeof queryKey[2] === 'number' ? queryKey[2] : 0;
    return fetchFeedTabPage({ pageParam, tab, refreshEpoch });
};

export const feedVideosQueryKey = (tab: FeedTab, epoch: number, viewerDid?: string | null) =>
    ['videos', tab, epoch, viewerDid ?? 'anon'] as const;

export function getFeedNextPageParam(lastPage: { meta?: { next_cursor?: string | null } }) {
    const cursor = lastPage.meta?.next_cursor;
    return cursor && cursor.length > 0 ? cursor : undefined;
}

/** Shared infinite-query options for feed tabs (prefetch + useInfiniteQuery). */
export const feedInfiniteQueryOptions = (
    tab: FeedTab,
    epoch: number,
    viewerDid: string | null | undefined,
    staleTime: number,
) => ({
    queryKey: feedVideosQueryKey(tab, epoch, viewerDid),
    queryFn: feedQueryFn,
    initialPageParam: null as string | null,
    getNextPageParam: getFeedNextPageParam,
    staleTime,
});
