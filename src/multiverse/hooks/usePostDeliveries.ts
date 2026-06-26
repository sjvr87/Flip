import { useQuery } from '@tanstack/react-query';
import { fetchPostDeliveries } from '../api';
import { getMultiverseToken } from '../session';

export function usePostDeliveries(postId: string | null, pollWhilePending = true) {
    return useQuery({
        queryKey: ['multiverse', 'deliveries', postId],
        enabled: !!postId && !!getMultiverseToken(),
        queryFn: async () => {
            const token = getMultiverseToken();
            if (!token || !postId) return [];
            return fetchPostDeliveries(token, postId);
        },
        refetchInterval: (query) => {
            if (!pollWhilePending) return false;
            const deliveries = query.state.data;
            if (!deliveries?.length) return 2000;
            const hasPending = deliveries.some((d) => d.status === 'pending');
            return hasPending ? 2000 : false;
        },
    });
}
