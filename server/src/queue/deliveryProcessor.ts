import { randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db/client.js';
import { redactSecrets } from '../crypto/tokens.js';
import { getProvider } from '../providers/registry.js';
import {
    computeBackoffMs,
    isTerminal,
    nextStatusAfterAttempt,
} from '../queue/deliveryState.js';
import type { PostDeliveryRow } from '../types.js';

const MAX_ATTEMPTS = Number(process.env.FLIP_DELIVERY_MAX_ATTEMPTS ?? 5);

const processing = new Set<string>();

export function deliveryIdempotencyKey(
    postId: string,
    provider: string,
    destinationAccountId: string | null,
): string {
    return `${postId}:${provider}:${destinationAccountId ?? 'native'}`;
}

export async function processDelivery(deliveryId: string): Promise<void> {
    if (processing.has(deliveryId)) return;
    processing.add(deliveryId);

    try {
        const delivery = dbGet<PostDeliveryRow>(
            'SELECT * FROM post_deliveries WHERE id = ?',
            [deliveryId],
        );

        if (!delivery || isTerminal(delivery.status)) return;

        const post = dbGet<{ body_text: string; media_type: string | null; media_uri: string | null }>(
            'SELECT body_text, media_type, media_uri FROM posts WHERE id = ?',
            [delivery.post_id],
        );

        if (!post) {
            markFailed(deliveryId, 'Post not found');
            return;
        }

        if (delivery.provider === 'flip') {
            markSent(deliveryId, delivery.post_id);
            return;
        }

        if (!delivery.destination_account_id) {
            markFailed(deliveryId, 'Missing destination account');
            return;
        }

        const provider = getProvider(delivery.provider);
        if (!provider) {
            markFailed(deliveryId, `Unknown provider: ${delivery.provider}`);
            return;
        }

        const attemptCount = delivery.attempt_count + 1;
        dbRun(
            `UPDATE post_deliveries SET attempt_count = ?, last_attempt_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?`,
            [attemptCount, deliveryId],
        );

        try {
            const result = await provider.createPost(delivery.destination_account_id, {
                text: post.body_text,
                mediaType: post.media_type,
                mediaUri: post.media_uri,
            });
            dbRun(
                `UPDATE post_deliveries SET status = 'sent', remote_post_id = ?, error_message = NULL,
                    next_attempt_at = NULL, updated_at = datetime('now') WHERE id = ?`,
                [result.remotePostId, deliveryId],
            );
        } catch (error) {
            const raw = error instanceof Error ? error.message : String(error);
            const message = redactSecrets(raw);
            const nextStatus = nextStatusAfterAttempt(
                delivery.status,
                false,
                attemptCount,
                MAX_ATTEMPTS,
            );

            if (nextStatus === 'failed') {
                dbRun(
                    `UPDATE post_deliveries SET status = 'failed', error_message = ?, next_attempt_at = NULL,
                        updated_at = datetime('now') WHERE id = ?`,
                    [message, deliveryId],
                );
            } else {
                const backoffMs = computeBackoffMs(attemptCount);
                const nextAt = new Date(Date.now() + backoffMs).toISOString();
                dbRun(
                    `UPDATE post_deliveries SET status = 'pending', error_message = ?, next_attempt_at = ?,
                        updated_at = datetime('now') WHERE id = ?`,
                    [message, nextAt, deliveryId],
                );
            }
        }
    } finally {
        processing.delete(deliveryId);
    }
}

function markSent(deliveryId: string, flipPostUri?: string): void {
    dbRun(
        `UPDATE post_deliveries SET status = 'sent', remote_post_id = COALESCE(remote_post_id, ?),
            error_message = NULL, next_attempt_at = NULL, updated_at = datetime('now') WHERE id = ?`,
        [flipPostUri ?? null, deliveryId],
    );
}

function markFailed(deliveryId: string, message: string): void {
    dbRun(
        `UPDATE post_deliveries SET status = 'failed', error_message = ?, next_attempt_at = NULL,
            updated_at = datetime('now') WHERE id = ?`,
        [redactSecrets(message), deliveryId],
    );
}

export function enqueueDeliveriesForPost(postId: string): void {
    const rows = dbAll<{ id: string }>(
        `SELECT id FROM post_deliveries WHERE post_id = ? AND status = 'pending'`,
        [postId],
    );

    for (const row of rows) {
        void processDelivery(row.id);
    }
}

export function startDeliveryWorker(intervalMs = 30_000): NodeJS.Timeout {
    return setInterval(() => {
        const due = dbAll<{ id: string }>(
            `SELECT id FROM post_deliveries
             WHERE status = 'pending'
               AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now'))
             ORDER BY created_at ASC LIMIT 20`,
        );

        for (const row of due) {
            void processDelivery(row.id);
        }
    }, intervalMs);
}

export function createDeliveries(
    postId: string,
    destinations: { provider: string; accountId?: string }[],
    flipPostUri?: string | null,
): string[] {
    const ids: string[] = [];

    for (const dest of destinations) {
        const id = randomUUID();
        const idempotencyKey = deliveryIdempotencyKey(
            postId,
            dest.provider,
            dest.accountId ?? null,
        );

        const existing = dbGet<{ id: string }>(
            'SELECT id FROM post_deliveries WHERE idempotency_key = ?',
            [idempotencyKey],
        );

        if (existing) {
            ids.push(existing.id);
            continue;
        }

        dbRun(
            `INSERT INTO post_deliveries
                (id, post_id, provider, destination_account_id, status, idempotency_key, remote_post_id)
             VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
            [
                id,
                postId,
                dest.provider,
                dest.accountId ?? null,
                idempotencyKey,
                dest.provider === 'flip' ? (flipPostUri ?? null) : null,
            ],
        );
        ids.push(id);
    }

    return ids;
}
