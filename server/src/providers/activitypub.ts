import { randomBytes } from 'node:crypto';
import type {
    CreatePostInput,
    CreatePostResult,
    ProviderConnectResult,
    ProviderProfile,
    ProviderTokens,
    SocialProvider,
} from './types.js';

/**
 * ActivityPub provider scaffold — interface wired, implementation deferred.
 * @see https://www.w3.org/TR/activitypub/
 */
export class ActivityPubProvider implements SocialProvider {
    readonly id = 'activitypub';

    async connect(_userId: string): Promise<ProviderConnectResult> {
        const state = randomBytes(16).toString('hex');
        return {
            flow: 'manual',
            state,
            instructions:
                'ActivityPub linking is not yet implemented. TODO: WebFinger + OAuth-style actor authorization.',
        };
    }

    async callback(
        _userId: string,
        _payload: Record<string, unknown>,
    ): Promise<{ accountId: string; handle: string; tokens: ProviderTokens }> {
        // TODO: Validate actor inbox/outbox, store actor URI + shared inbox secret
        throw new Error('ActivityPub connect callback is not implemented (Phase 2)');
    }

    async refreshToken(_accountId: string): Promise<ProviderTokens> {
        // TODO: Rotate HTTP signatures or OAuth token if applicable
        throw new Error('ActivityPub token refresh is not implemented');
    }

    async createPost(_accountId: string, _input: CreatePostInput): Promise<CreatePostResult> {
        // TODO: Build ActivityStreams Note, POST to outbox, handle HTTP Signatures
        throw new Error('ActivityPub posting is not implemented');
    }

    async getProfile(_accountId: string): Promise<ProviderProfile> {
        // TODO: Fetch actor object via WebFinger + actor endpoint
        throw new Error('ActivityPub profile fetch is not implemented');
    }

    async disconnect(_accountId: string): Promise<void> {
        // TODO: Revoke stored actor credentials
    }
}

export const activityPubProvider = new ActivityPubProvider();
