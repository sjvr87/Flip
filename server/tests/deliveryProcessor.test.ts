import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDb, dbGet, dbRun, getDbPath } from '../src/db/client.js';
import { processDelivery } from '../src/queue/deliveryProcessor.js';

let userId: string;

beforeAll(async () => {
    process.env.FLIP_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-chars-min!!';
    const dbPath = path.join(os.tmpdir(), `flip-delivery-test-${Date.now()}.db`);
    process.env.FLIP_DB_PATH = dbPath;
    closeDb();

    const app = await createApp();
    const session = await request(app)
        .post('/api/session/bootstrap')
        .send({ did: 'did:plc:deliverytest', handle: 'delivery.bsky.social' });

    userId = session.body.user.id;
});

afterAll(() => {
    const dbPath = getDbPath();
    closeDb();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('scaffold provider delivery', () => {
    it('marks nostr delivery as not_implemented without sending', async () => {
        const postId = randomUUID();
        const deliveryId = randomUUID();
        const accountId = randomUUID();

        dbRun(
            `INSERT INTO external_accounts (id, user_id, provider, handle, metadata_json, status)
             VALUES (?, ?, 'nostr', 'npub1test', '{"pubkey":"abc","relays":["wss://relay.test"]}', 'active')`,
            [accountId, userId],
        );
        dbRun(
            `INSERT INTO posts (id, user_id, body_text) VALUES (?, ?, 'nostr scaffold')`,
            [postId, userId],
        );
        dbRun(
            `INSERT INTO post_deliveries
                (id, post_id, provider, destination_account_id, destination, status, idempotency_key)
             VALUES (?, ?, 'nostr', ?, '{"relays":["wss://relay.test"]}', 'pending', ?)`,
            [deliveryId, postId, accountId, `${postId}:nostr:${accountId}`],
        );

        await processDelivery(deliveryId);

        const row = dbGet<{ status: string; remote_post_id: string | null; error_message: string | null }>(
            'SELECT status, remote_post_id, error_message FROM post_deliveries WHERE id = ?',
            [deliveryId],
        );

        expect(row?.status).toBe('not_implemented');
        expect(row?.remote_post_id).toBeNull();
        expect(row?.error_message).toContain('NOT_IMPLEMENTED');
    });
});
