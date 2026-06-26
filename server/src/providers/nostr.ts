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
 * Nostr provider scaffold — connect/sign/publish/profile interfaces wired.
 * Relay publish and NIP handling deferred until FF_PROVIDER_NOSTR is validated.
 */
export class NostrProvider implements SocialProvider {
    readonly id = ProviderIds.NOSTR;

    async connect(_userId: string): Promise<ProviderConnectResult> {
        const state = randomBytes(16).toString('hex');
        return {
            flow: 'nostr_keys',
            state,
            instructions:
                'Nostr linking is scaffolded. TODO: nsec/npub or NIP-46 remote signer flow; store pubkey + relay list in metadata_json.',
        };
    }

    async callback(
        _userId: string,
        _payload: Record<string, unknown>,
    ): Promise<{ accountId: string; handle: string; tokens: ProviderTokens }> {
        // TODO: Validate pubkey, encrypt nsec or NIP-46 token, persist relays + nipCapabilities
        throw new Error(`${NOT_IMPLEMENTED}: Nostr connect callback`);
    }

    async disconnect(_accountId: string): Promise<void> {
        // TODO: Revoke stored keys / remote signer session
    }

    async refreshAuth(_accountId: string): Promise<ProviderTokens> {
        // TODO: Rotate NIP-46 session or verify relay connectivity
        throw new Error(`${NOT_IMPLEMENTED}: Nostr refreshAuth`);
    }

    async createPost(_accountId: string, _input: CreatePostInput): Promise<CreatePostResult> {
        // TODO: Build kind-1 event, sign, publish to configured relays (NIP-01)
        throw new Error(`${NOT_IMPLEMENTED}: Nostr createPost`);
    }

    async deletePost(_accountId: string, _remotePostId: string): Promise<void> {
        // TODO: Publish kind-5 deletion request to relays
        throw new Error(`${NOT_IMPLEMENTED}: Nostr deletePost`);
    }

    async getProfile(_accountId: string): Promise<ProviderProfile> {
        // TODO: Fetch profile metadata (kind 0) from relays
        throw new Error(`${NOT_IMPLEMENTED}: Nostr getProfile`);
    }

    async healthCheck(_accountId: string): Promise<ProviderHealthResult> {
        // TODO: Ping configured relays, verify signer availability
        return { ok: false, message: `${NOT_IMPLEMENTED}: Nostr healthCheck` };
    }
}

export const nostrProvider = new NostrProvider();

export function isNostrNotImplementedError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(NOT_IMPLEMENTED);
}
