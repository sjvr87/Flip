import { fetchFollowingDidsSet, isAccountFollowed } from '@/atproto/feeds';
import { useAuthStore } from '@/utils/authStore';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

export const FOLLOWING_DIDS_QUERY_KEY = ['followingDids'] as const;

function normalizeFollowingSet(data: unknown): Set<string> {
    if (data instanceof Set) {
        return data;
    }
    return new Set<string>();
}

export function useFollowingDids() {
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    const {
        data: followingDids,
        isSuccess,
        isError,
        isFetched,
    } = useQuery({
        queryKey: FOLLOWING_DIDS_QUERY_KEY,
        queryFn: fetchFollowingDidsSet,
        enabled: isLoggedIn,
        staleTime: 5 * 60_000,
    });

    const dids = useMemo(() => normalizeFollowingSet(followingDids), [followingDids]);

    const isFollowing = useCallback(
        (account: { id?: string; username?: string }) => isAccountFollowed(account, dids),
        [dids],
    );

    return {
        followingDids: dids,
        isFollowing,
        /** True once we can decide follow state, or when logged out (no badge). */
        isReady: !isLoggedIn || isSuccess || isError || isFetched,
    };
}
