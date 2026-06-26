import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/sessions.js';
import { dbAll, dbGet, dbRun } from '../db/client.js';
import { redactSecrets } from '../crypto/tokens.js';
import { createDeliveries, enqueueDeliveriesForPost } from '../queue/deliveryProcessor.js';
import { normalizeProviderId } from '../providers/registry.js';
import type { PostDestinationInput, PostDeliveryRow, PostRow } from '../types.js';
import { ProviderIds } from '../config/providers.js';

export const postsRouter = Router();

postsRouter.use(requireAuth);

postsRouter.post('/', (req: AuthedRequest, res) => {
    try {
        const body = req.body ?? {};
        const text = String(body.text ?? '').trim();
        const destinations = Array.isArray(body.destinations)
            ? (body.destinations as PostDestinationInput[])
            : [];
        const flipPostUri = body.flipPostUri ? String(body.flipPostUri) : null;
        const mediaType = body.mediaType ? String(body.mediaType) : null;
        const mediaUri = body.mediaUri ? String(body.mediaUri) : null;

        if (!text && !mediaUri) {
            res.status(400).json({ error: 'text or mediaUri is required' });
            return;
        }
        if (destinations.length === 0) {
            res.status(400).json({ error: 'At least one destination is required' });
            return;
        }

        for (const dest of destinations) {
            const provider = normalizeProviderId(String(dest.provider ?? ''));
            if (!provider) {
                res.status(400).json({ error: `Unknown provider: ${dest.provider}` });
                return;
            }
            if (provider !== ProviderIds.FLIP_LOCAL && !dest.accountId) {
                res.status(400).json({
                    error: `accountId required for provider ${provider}`,
                });
                return;
            }
        }

        const postId = randomUUID();
        dbRun(
            `INSERT INTO posts (id, user_id, body_text, media_type, media_uri, flip_post_uri)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [postId, req.flipUser!.id, text, mediaType, mediaUri, flipPostUri],
        );

        const deliveryIds = createDeliveries(
            postId,
            destinations.map((d) => ({
                provider: normalizeProviderId(String(d.provider)) ?? String(d.provider),
                accountId: d.accountId,
                destination: d.destination ?? null,
            })),
            flipPostUri,
        );

        enqueueDeliveriesForPost(postId);

        res.status(201).json({ postId, deliveryIds });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Post creation failed';
        res.status(500).json({ error: redactSecrets(message) });
    }
});

postsRouter.get('/:id/deliveries', (req: AuthedRequest, res) => {
    const post = dbGet<PostRow>('SELECT * FROM posts WHERE id = ? AND user_id = ?', [
        req.params.id,
        req.flipUser!.id,
    ]);

    if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
    }

    const deliveries = dbAll<PostDeliveryRow>(
        'SELECT * FROM post_deliveries WHERE post_id = ? ORDER BY created_at ASC',
        [post.id],
    );

    res.json({
        postId: post.id,
        deliveries: deliveries.map((d) => ({
            id: d.id,
            provider: d.provider,
            destinationAccountId: d.destination_account_id,
            destination: d.destination,
            status: d.status,
            remotePostId: d.remote_post_id,
            errorMessage: d.error_message,
            attemptCount: d.attempt_count,
            lastAttemptAt: d.last_attempt_at,
            nextAttemptAt: d.next_attempt_at,
        })),
    });
});
