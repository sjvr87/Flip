export type MultiverseProvider = 'flip' | 'bluesky' | 'activitypub';

export type ExternalAccountStatus = 'active' | 'revoked' | 'error';

export type DeliveryStatus = 'pending' | 'sent' | 'failed';

export type ConnectedAccount = {
    id: string;
    provider: MultiverseProvider;
    handle: string;
    status: ExternalAccountStatus;
    metadata?: Record<string, unknown>;
    expiresAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
};

export type PostDestination = {
    provider: MultiverseProvider;
    accountId?: string;
    label: string;
    enabled: boolean;
};

export type PostDelivery = {
    id: string;
    provider: MultiverseProvider;
    destinationAccountId?: string | null;
    status: DeliveryStatus;
    remotePostId?: string | null;
    errorMessage?: string | null;
    attemptCount: number;
    lastAttemptAt?: string | null;
    nextAttemptAt?: string | null;
};

export type ConnectFlowResult = {
    flow: 'app_password' | 'oauth' | 'manual';
    state: string;
    redirectUrl?: string;
    instructions?: string;
};
