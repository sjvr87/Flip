import { ProviderIds } from '../config/providers.js';

export type ProviderId =
    | typeof ProviderIds.FLIP_LOCAL
    | typeof ProviderIds.ATPROTO
    | typeof ProviderIds.NOSTR
    | typeof ProviderIds.ACTIVITYPUB;

export type ExternalAccountStatus = 'active' | 'revoked' | 'error';

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'not_implemented';

/** Nostr-specific fields stored in external_accounts.metadata_json */
export type NostrAccountMetadata = {
    pubkey?: string;
    relays?: string[];
    nipCapabilities?: string[];
};

export type UserRow = {
    id: string;
    did: string;
    handle: string | null;
    created_at: string;
};

export type ExternalAccountRow = {
    id: string;
    user_id: string;
    provider: string;
    handle: string;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    expires_at: string | null;
    metadata_json: string;
    status: ExternalAccountStatus;
    created_at: string;
    updated_at: string;
};

export type PostRow = {
    id: string;
    user_id: string;
    body_text: string;
    media_type: string | null;
    media_uri: string | null;
    flip_post_uri: string | null;
    created_at: string;
};

export type PostDeliveryRow = {
    id: string;
    post_id: string;
    provider: string;
    destination_account_id: string | null;
    destination: string | null;
    status: DeliveryStatus;
    remote_post_id: string | null;
    error_message: string | null;
    attempt_count: number;
    last_attempt_at: string | null;
    next_attempt_at: string | null;
    idempotency_key: string;
    created_at: string;
    updated_at: string;
};

export type PostDestinationInput = {
    provider: ProviderId | 'flip' | 'bluesky';
    accountId?: string;
    /** Relay list, actor URI, or other provider-specific target JSON. */
    destination?: string | Record<string, unknown> | null;
};
