import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDb, getDbPath } from '../src/db/client.js';

let token: string;

beforeAll(async () => {
    process.env.FLIP_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-chars-min!!';
    const dbPath = path.join(os.tmpdir(), `flip-test-${Date.now()}.db`);
    process.env.FLIP_DB_PATH = dbPath;

    closeDb();

    const app = await createApp();
    const session = await request(app)
        .post('/api/session/bootstrap')
        .send({ did: 'did:plc:testuser', handle: 'alice.bsky.social' });

    token = session.body.token;
});

afterAll(() => {
    const dbPath = getDbPath();
    closeDb();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('posts API', () => {
    it('creates post with deliveries', async () => {
        const app = await createApp();
        const res = await request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({
                text: 'Hello multiverse',
                destinations: [{ provider: 'flip' }],
                flipPostUri: 'at://did:plc:test/app.bsky.feed.post/abc',
            });

        expect(res.status).toBe(201);
        expect(res.body.postId).toBeTruthy();
        expect(res.body.deliveryIds?.length).toBe(1);
    });

    it('returns delivery status', async () => {
        const app = await createApp();
        const created = await request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({
                text: 'Status check',
                destinations: [{ provider: 'flip' }],
            });

        const postId = created.body.postId;
        const res = await request(app)
            .get(`/api/posts/${postId}/deliveries`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.deliveries).toHaveLength(1);
        expect(res.body.deliveries[0].provider).toBe('flip');
    });

    it('rejects unauthenticated requests', async () => {
        const app = await createApp();
        const res = await request(app).post('/api/posts').send({ text: 'nope', destinations: [] });
        expect(res.status).toBe(401);
    });
});
