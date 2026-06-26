import type { ProviderId } from '../types.js';

export type ProviderConnectResult = {
    flow: 'app_password' | 'oauth' | 'manual' | 'nostr_keys';
    state: string;
    redirectUrl?: string;
    instructions?: string;
};

export type ProviderProfile = {
    handle: string;
    displayName?: string;
    avatarUrl?: string;
};

export type ProviderHealthResult = {
    ok: boolean;
    message?: string;
};

export type ProviderTokens = {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
};

export type CreatePostInput = {
    text: string;
    mediaType?: string | null;
    mediaUri?: string | null;
    destination?: string | null;
};

export type CreatePostResult = {
    remotePostId: string;
};

export interface SocialProvider {
    readonly id: ProviderId;
    connect(userId: string): Promise<ProviderConnectResult>;
    /** Complete OAuth / app-password / key linking after connect(). */
    callback(
        userId: string,
        payload: Record<string, unknown>,
    ): Promise<{ accountId: string; handle: string; tokens: ProviderTokens }>;
    disconnect(accountId: string): Promise<void>;
    refreshAuth(accountId: string): Promise<ProviderTokens>;
    createPost(accountId: string, input: CreatePostInput): Promise<CreatePostResult>;
    deletePost(accountId: string, remotePostId: string): Promise<void>;
    getProfile(accountId: string): Promise<ProviderProfile>;
    healthCheck(accountId: string): Promise<ProviderHealthResult>;
}
