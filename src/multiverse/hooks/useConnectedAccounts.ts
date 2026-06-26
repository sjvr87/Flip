import { useQuery } from '@tanstack/react-query';
import { listConnectedAccounts } from '../api';
import { ensureMultiverseSession } from '../session';
import { isMultiverseEnabled } from '../config';
import { useAuthStore } from '@/utils/authStore';

export const connectedAccountsQueryKey = ['multiverse', 'accounts'] as const;

export function useConnectedAccounts() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: connectedAccountsQueryKey,
        enabled: isMultiverseEnabled() && !!user?.id,
        queryFn: async () => {
            const token = await ensureMultiverseSession(user!.id, user?.username);
            return listConnectedAccounts(token);
        },
        staleTime: 30_000,
    });
}
