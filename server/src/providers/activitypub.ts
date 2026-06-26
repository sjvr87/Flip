import { randomBytes } from 'node:crypto';
import { ProviderIds } from '../config/providers.js';
import type {
    CreatePostInput,
    CreatePostResult,
    ProviderConnectResult,
    ProviderHealthResult,
    ProviderProfile,
    ProviderTokens,
    SocialProvider,
} from './types.js';

const NOT_IMPLEMENTED = 'NOT_IMPLEMENTED';

/**
 * ActivityPub provider scaffold — interface wired, implementation deferred.
 * @see https://www.w3.org/TR/activitypub/
 */
export class ActivityPubProvider implements SocialProvider {
    readonly id = ProviderIds.ACTIVITYPUB;

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
        throw new Error(`${NOT_IMPLEMENTED}: ActivityPub connect callback`);
    }

    async disconnect(_accountId: string): Promise<void> {
        // TODO: Revoke stored actor credentials
    }

    async refreshAuth(_accountId: string): Promise<ProviderTokens> {
        // TODO: Rotate HTTP signatures or OAuth token if applicable
        throw new Error(`${NOT_IMPLEMENTED}: ActivityPub refreshAuth`);
    }

    async createPost(_accountId: string, _input: CreatePostInput): Promise<CreatePostResult> {
        // TODO: Build ActivityStreams Note, POST to outbox, handle HTTP Signatures
        throw new Error(`${NOT_IMPLEMENTED}: ActivityPub createPost`);
    }

    async deletePost(_accountId: string, _remotePostId: string): Promise<void> {
        // TODO: Send Delete activity to outbox
        throw new Error(`${NOT_IMPLEMENTED}: ActivityPub deletePost`);
    }

    async getProfile(_accountId: string): Promise<ProviderProfile> {
        // TODO: Fetch actor object via WebFinger + actor endpoint
        throw new Error(`${NOT_IMPLEMENTED}: ActivityPub getProfile`);
    }

    async healthCheck(_accountId: string): Promise<ProviderHealthResult> {
        return { ok: false, message: `${NOT_IMPLEMENTED}: ActivityPub healthCheck` };
    }
}

export const activityPubProvider = new ActivityPubProvider();

export function isActivityPubNotImplementedError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(NOT_IMPLEMENTED);
}
