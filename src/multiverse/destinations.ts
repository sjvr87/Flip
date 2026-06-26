import { isProviderEnabled, providerLabel } from './config';
import type { ConnectedAccount, NostrAccountMetadata, PostDestination } from './types';
import { MultiverseProviderIds, isBetaProvider, normalizeClientProvider } from './types';

function isDestinationAvailable(account: ConnectedAccount): boolean {
    const provider = normalizeClientProvider(account.provider);
    if (!provider) return false;
    if (provider === MultiverseProviderIds.ATPROTO) {
        return isProviderEnabled('ATPROTO');
    }
    if (provider === MultiverseProviderIds.NOSTR) {
        return isProviderEnabled('NOSTR');
    }
    if (provider === MultiverseProviderIds.ACTIVITYPUB) {
        return isProviderEnabled('ACTIVITYPUB');
    }
    return false;
}

export function buildDefaultPostDestinations(accounts: ConnectedAccount[]): PostDestination[] {
    const flip: PostDestination = {
        provider: MultiverseProviderIds.FLIP_LOCAL,
        label: 'Flip',
        enabled: true,
    };
    const linked = accounts
        .filter((a) => a.status === 'active' && isDestinationAvailable(a))
        .map((a) => {
            const provider = normalizeClientProvider(a.provider) ?? a.provider;
            const nostrMeta = a.metadata as NostrAccountMetadata | undefined;
            const destination =
                provider === MultiverseProviderIds.NOSTR && nostrMeta?.relays?.length
                    ? { relays: nostrMeta.relays, pubkey: nostrMeta.pubkey }
                    : null;
            return {
                provider,
                accountId: a.id,
                label: `${providerLabel(String(provider))} · @${a.handle.replace(/^@/, '')}`,
                enabled: provider === MultiverseProviderIds.ATPROTO,
                beta: isBetaProvider(String(provider)),
                destination,
            } satisfies PostDestination;
        });
    return [flip, ...linked];
}
