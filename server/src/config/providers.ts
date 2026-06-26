import type { ProviderId } from '../types.js';

export const ProviderIds = {
    FLIP_LOCAL: 'flip_local',
    ATPROTO: 'atproto',
    NOSTR: 'nostr',
    ACTIVITYPUB: 'activitypub',
} as const;

/** Legacy aliases accepted in API payloads and stored rows. */
const PROVIDER_ALIASES: Record<string, ProviderId> = {
    flip: ProviderIds.FLIP_LOCAL,
    bluesky: ProviderIds.ATPROTO,
    [ProviderIds.FLIP_LOCAL]: ProviderIds.FLIP_LOCAL,
    [ProviderIds.ATPROTO]: ProviderIds.ATPROTO,
    [ProviderIds.NOSTR]: ProviderIds.NOSTR,
    [ProviderIds.ACTIVITYPUB]: ProviderIds.ACTIVITYPUB,
};

export function normalizeProviderId(raw: string): ProviderId | null {
    return PROVIDER_ALIASES[raw] ?? null;
}

function envFlag(name: string, defaultValue: boolean): boolean {
    const value = process.env[name];
    if (value === undefined) return defaultValue;
    return value === '1' || value.toLowerCase() === 'true';
}

export function isProviderFeatureEnabled(provider: ProviderId): boolean {
    switch (provider) {
        case ProviderIds.FLIP_LOCAL:
            return true;
        case ProviderIds.ATPROTO:
            return envFlag('FF_PROVIDER_ATPROTO', true);
        case ProviderIds.NOSTR:
            return envFlag('FF_PROVIDER_NOSTR', false);
        case ProviderIds.ACTIVITYPUB:
            return envFlag('FF_PROVIDER_ACTIVITYPUB', false);
        default:
            return false;
    }
}

/** Scaffold providers — interface wired, delivery fanout returns NOT_IMPLEMENTED. */
export function isScaffoldProvider(provider: ProviderId): boolean {
    return provider === ProviderIds.NOSTR || provider === ProviderIds.ACTIVITYPUB;
}

export function listEnabledProviderIds(): ProviderId[] {
    return (Object.values(ProviderIds) as ProviderId[]).filter(isProviderFeatureEnabled);
}
