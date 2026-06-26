export type ProviderConnectResult = {
    flow: 'app_password' | 'oauth' | 'manual';
    state: string;
    redirectUrl?: string;
    instructions?: string;
};

export type ProviderProfile = {
    handle: string;
    displayName?: string;
    avatarUrl?: string;
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
};

export type CreatePostResult = {
    remotePostId: string;
};

export interface SocialProvider {
    readonly id: string;
    connect(userId: string): Promise<ProviderConnectResult>;
    callback(
        userId: string,
        payload: Record<string, unknown>,
    ): Promise<{ accountId: string; handle: string; tokens: ProviderTokens }>;
    refreshToken(accountId: string): Promise<ProviderTokens>;
    createPost(accountId: string, input: CreatePostInput): Promise<CreatePostResult>;
    getProfile(accountId: string): Promise<ProviderProfile>;
    disconnect?(accountId: string): Promise<void>;
}
