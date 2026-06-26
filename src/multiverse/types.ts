export const MultiverseProviderIds = {
    FLIP_LOCAL: 'flip_local',
    ATPROTO: 'atproto',
    NOSTR: 'nostr',
    ACTIVITYPUB: 'activitypub',
} as const;

export type MultiverseProvider =
    | typeof MultiverseProviderIds.FLIP_LOCAL
    | typeof MultiverseProviderIds.ATPROTO
    | typeof MultiverseProviderIds.NOSTR
    | typeof MultiverseProviderIds.ACTIVITYPUB;

/** @deprecated Legacy alias — normalize API responses */
export type LegacyMultiverseProvider = MultiverseProvider | 'flip' | 'bluesky';

export type ExternalAccountStatus = 'active' | 'revoked' | 'error';

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'not_implemented';

export type NostrAccountMetadata = {
    pubkey?: string;
    relays?: string[];
    nipCapabilities?: string[];
};

export type ConnectedAccount = {
    id: string;
    provider: MultiverseProvider | 'flip' | 'bluesky';
    handle: string;
    status: ExternalAccountStatus;
    metadata?: Record<string, unknown> & Partial<NostrAccountMetadata>;
    expiresAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
};

export type PostDestination = {
    provider: MultiverseProvider | 'flip' | 'bluesky';
    accountId?: string;
    label: string;
    enabled: boolean;
    beta?: boolean;
    destination?: string | Record<string, unknown> | null;
};

export type PostDelivery = {
    id: string;
    provider: MultiverseProvider | 'flip' | 'bluesky';
    destinationAccountId?: string | null;
    destination?: string | null;
    status: DeliveryStatus;
    remotePostId?: string | null;
    errorMessage?: string | null;
    attemptCount: number;
    lastAttemptAt?: string | null;
    nextAttemptAt?: string | null;
};

export type ConnectFlowResult = {
    flow: 'app_password' | 'oauth' | 'manual' | 'nostr_keys';
    state: string;
    redirectUrl?: string;
    instructions?: string;
};

export function normalizeClientProvider(raw: string): MultiverseProvider | null {
    if (raw === 'flip') return MultiverseProviderIds.FLIP_LOCAL;
    if (raw === 'bluesky') return MultiverseProviderIds.ATPROTO;
    if (
        raw === MultiverseProviderIds.FLIP_LOCAL ||
        raw === MultiverseProviderIds.ATPROTO ||
        raw === MultiverseProviderIds.NOSTR ||
        raw === MultiverseProviderIds.ACTIVITYPUB
    ) {
        return raw;
    }
    return null;
}

export function isBetaProvider(provider: string): boolean {
    const normalized = normalizeClientProvider(provider);
    return normalized === MultiverseProviderIds.NOSTR || normalized === MultiverseProviderIds.ACTIVITYPUB;
}
