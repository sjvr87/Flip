import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/sessions.js';
import { dbAll, dbGet, dbRun } from '../db/client.js';
import { isProviderFeatureEnabled } from '../config/providers.js';
import { getProvider, normalizeProviderId } from '../providers/registry.js';
import { redactSecrets } from '../crypto/tokens.js';
import type { ExternalAccountRow } from '../types.js';

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

accountsRouter.post('/connect/:provider', async (req: AuthedRequest, res) => {
    try {
        const providerId = normalizeProviderId(req.params.provider);
        if (!providerId) {
            res.status(400).json({ error: `Unsupported provider: ${req.params.provider}` });
            return;
        }
        if (!isProviderFeatureEnabled(providerId)) {
            res.status(503).json({ error: `Provider ${providerId} is disabled by feature flag` });
            return;
        }
        const provider = getProvider(providerId);
        if (!provider) {
            res.status(400).json({ error: `Unsupported provider: ${providerId}` });
            return;
        }
        const result = await provider.connect(req.flipUser!.id);
        res.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Connect failed';
        res.status(500).json({ error: redactSecrets(message) });
    }
});

accountsRouter.post('/callback/:provider', async (req: AuthedRequest, res) => {
    try {
        const providerId = normalizeProviderId(req.params.provider);
        if (!providerId) {
            res.status(400).json({ error: `Unsupported provider: ${req.params.provider}` });
            return;
        }
        if (!isProviderFeatureEnabled(providerId)) {
            res.status(503).json({ error: `Provider ${providerId} is disabled by feature flag` });
            return;
        }
        const provider = getProvider(providerId);
        if (!provider) {
            res.status(400).json({ error: `Unsupported provider: ${providerId}` });
            return;
        }
        const result = await provider.callback(req.flipUser!.id, req.body ?? {});
        res.json({
            accountId: result.accountId,
            handle: result.handle,
            provider: providerId,
            status: 'active',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Callback failed';
        res.status(400).json({ error: redactSecrets(message) });
    }
});

accountsRouter.get('/', (req: AuthedRequest, res) => {
    const rows = dbAll<ExternalAccountRow>(
        `SELECT id, provider, handle, status, metadata_json, expires_at, created_at, updated_at
         FROM external_accounts WHERE user_id = ? AND status != 'revoked'
         ORDER BY created_at DESC`,
        [req.flipUser!.id],
    );

    res.json({
        accounts: rows.map((row) => ({
            id: row.id,
            provider: row.provider,
            handle: row.handle,
            status: row.status,
            metadata: safeJson(row.metadata_json),
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })),
    });
});

accountsRouter.delete('/:accountId', async (req: AuthedRequest, res) => {
    const row = dbGet<ExternalAccountRow>(
        'SELECT * FROM external_accounts WHERE id = ? AND user_id = ?',
        [req.params.accountId, req.flipUser!.id],
    );

    if (!row) {
        res.status(404).json({ error: 'Account not found' });
        return;
    }

    const provider = getProvider(row.provider);
    if (provider?.disconnect) {
        await provider.disconnect(row.id);
    } else {
        dbRun(
            `UPDATE external_accounts SET status = 'revoked', updated_at = datetime('now') WHERE id = ?`,
            [row.id],
        );
    }

    res.json({ ok: true });
});

function safeJson(raw: string): Record<string, unknown> {
    try {
        return JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
        return {};
    }
}
