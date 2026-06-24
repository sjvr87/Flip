import { fetchFollowingDidsSet, isAccountFollowed } from '@/atproto/feeds';
import { useAuthStore } from '@/utils/authStore';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

export function useFollowingDids() {
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    const { data: followingDids, isSuccess } = useQuery({
        queryKey: ['followingDids'],
        queryFn: fetchFollowingDidsSet,
        enabled: isLoggedIn,
        staleTime: 5 * 60_000,
    });

    const dids = useMemo(() => followingDids ?? new Set<string>(), [followingDids]);

    const isFollowing = useCallback(
        (account: { id?: string; username?: string }) => isAccountFollowed(account, dids),
        [dids],
    );

    return { followingDids: dids, isFollowing, isReady: !isLoggedIn || isSuccess };
}
