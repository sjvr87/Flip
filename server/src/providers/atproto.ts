import { AtpAgent } from '@atproto/api';
import { randomBytes, randomUUID } from 'node:crypto';
import { ProviderIds } from '../config/providers.js';
import { dbGet, dbRun } from '../db/client.js';
import { decryptToken, encryptToken, redactSecrets } from '../crypto/tokens.js';
import type {
    CreatePostInput,
    CreatePostResult,
    ProviderConnectResult,
    ProviderHealthResult,
    ProviderProfile,
    ProviderTokens,
    SocialProvider,
} from './types.js';
import type { ExternalAccountRow } from '../types.js';

const connectStates = new Map<string, { userId: string; provider: string; expiresAt: number }>();

function storeConnectState(userId: string, provider: string): string {
    const state = randomBytes(16).toString('hex');
    connectStates.set(state, {
        userId,
        provider,
        expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return state;
}

function consumeConnectState(state: string, userId: string, provider: string): boolean {
    const entry = connectStates.get(state);
    if (!entry) return false;
    connectStates.delete(state);
    if (entry.expiresAt < Date.now()) return false;
    return entry.userId === userId && entry.provider === provider;
}

function loadAccount(accountId: string): ExternalAccountRow {
    const row = dbGet<ExternalAccountRow>(
        'SELECT * FROM external_accounts WHERE id = ? AND provider = ?',
        [accountId, ProviderIds.ATPROTO],
    );
    if (!row) throw new Error('ATProto account not found');
    if (row.status !== 'active') throw new Error('ATProto account is not active');
    return row;
}

function parseSession(row: ExternalAccountRow): { accessJwt: string; refreshJwt: string; did: string } {
    const metadata = JSON.parse(row.metadata_json || '{}') as {
        did?: string;
        service?: string;
    };
    if (!row.access_token_encrypted || !metadata.did) {
        throw new Error('ATProto session is incomplete');
    }
    return {
        accessJwt: decryptToken(row.access_token_encrypted),
        refreshJwt: row.refresh_token_encrypted
            ? decryptToken(row.refresh_token_encrypted)
            : '',
        did: metadata.did,
    };
}

async function agentForAccount(accountId: string): Promise<AtpAgent> {
    const row = loadAccount(accountId);
    const metadata = JSON.parse(row.metadata_json || '{}') as { service?: string; did?: string };
    const service = metadata.service ?? 'https://bsky.social';
    const session = parseSession(row);
    const agent = new AtpAgent({ service });
    await agent.resumeSession({
        did: session.did,
        handle: row.handle,
        accessJwt: session.accessJwt,
        refreshJwt: session.refreshJwt,
        active: true,
    });
    return agent;
}

export class AtprotoProvider implements SocialProvider {
    readonly id = ProviderIds.ATPROTO;

    async connect(userId: string): Promise<ProviderConnectResult> {
        const state = storeConnectState(userId, this.id);
        return {
            flow: 'app_password',
            state,
            instructions:
                'Submit your Bluesky handle and app password to complete linking. Use bsky.app → Settings → App passwords.',
        };
    }

    async callback(
        userId: string,
        payload: Record<string, unknown>,
    ): Promise<{ accountId: string; handle: string; tokens: ProviderTokens }> {
        const state = String(payload.state ?? '');
        const handle = String(payload.handle ?? '').trim();
        const appPassword = String(payload.appPassword ?? '');
        const service = String(payload.service ?? 'https://bsky.social');

        if (!consumeConnectState(state, userId, this.id)) {
            throw new Error('Invalid or expired connect state');
        }
        if (!handle || !appPassword) {
            throw new Error('handle and appPassword are required');
        }

        const agent = new AtpAgent({ service });
        await agent.login({ identifier: handle, password: appPassword });
        const session = agent.session;
        if (!session) throw new Error('ATProto login failed');

        const tokens: ProviderTokens = {
            accessToken: session.accessJwt,
            refreshToken: session.refreshJwt,
            metadata: { did: session.did, service },
        };

        const existing = dbGet<{ id: string }>(
            'SELECT id FROM external_accounts WHERE user_id = ? AND provider = ? AND handle = ?',
            [userId, this.id, session.handle],
        );

        const accountId = existing?.id ?? randomUUID();
        const accessEnc = encryptToken(session.accessJwt);
        const refreshEnc = session.refreshJwt ? encryptToken(session.refreshJwt) : null;
        const metadataJson = JSON.stringify({ did: session.did, service });

        if (existing) {
            dbRun(
                `UPDATE external_accounts SET
                    access_token_encrypted = ?, refresh_token_encrypted = ?,
                    metadata_json = ?, status = 'active', updated_at = datetime('now')
                 WHERE id = ?`,
                [accessEnc, refreshEnc, metadataJson, accountId],
            );
        } else {
            dbRun(
                `INSERT INTO external_accounts
                    (id, user_id, provider, handle, access_token_encrypted, refresh_token_encrypted, metadata_json, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                [accountId, userId, this.id, session.handle, accessEnc, refreshEnc, metadataJson],
            );
        }

        return { accountId, handle: session.handle, tokens };
    }

    async disconnect(accountId: string): Promise<void> {
        dbRun(
            `UPDATE external_accounts SET status = 'revoked', updated_at = datetime('now') WHERE id = ?`,
            [accountId],
        );
    }

    async refreshAuth(accountId: string): Promise<ProviderTokens> {
        const agent = await agentForAccount(accountId);
        if (!agent.session) throw new Error('No active ATProto session');
        const refreshed = await agent.com.atproto.server.refreshSession(undefined, {
            headers: { Authorization: `Bearer ${agent.session.refreshJwt}` },
        });
        const accessJwt = refreshed.data.accessJwt;
        const refreshJwt = refreshed.data.refreshJwt;

        dbRun(
            `UPDATE external_accounts SET
                access_token_encrypted = ?, refresh_token_encrypted = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [encryptToken(accessJwt), encryptToken(refreshJwt), accountId],
        );

        return { accessToken: accessJwt, refreshToken: refreshJwt };
    }

    async createPost(accountId: string, input: CreatePostInput): Promise<CreatePostResult> {
        try {
            const agent = await agentForAccount(accountId);
            const record = {
                $type: 'app.bsky.feed.post' as const,
                text: input.text,
                createdAt: new Date().toISOString(),
            };
            const result = await agent.post(record);
            return { remotePostId: result.uri };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(redactSecrets(msg));
        }
    }

    async deletePost(accountId: string, remotePostId: string): Promise<void> {
        const agent = await agentForAccount(accountId);
        await agent.deletePost(remotePostId);
    }

    async getProfile(accountId: string): Promise<ProviderProfile> {
        const agent = await agentForAccount(accountId);
        const did = agent.session?.did;
        if (!did) throw new Error('No ATProto session');
        const profile = await agent.getProfile({ actor: did });
        return {
            handle: profile.data.handle,
            displayName: profile.data.displayName,
            avatarUrl: profile.data.avatar,
        };
    }

    async healthCheck(accountId: string): Promise<ProviderHealthResult> {
        try {
            await this.getProfile(accountId);
            return { ok: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { ok: false, message: redactSecrets(message) };
        }
    }
}

export const atprotoProvider = new AtprotoProvider();

/** @deprecated Use atprotoProvider — kept for import compatibility during Phase 1. */
export const blueskyProvider = atprotoProvider;
