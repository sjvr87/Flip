import express from 'express';
import { initDb, runMigrations } from './db/client.js';
import { blueskyProvider } from './providers/bluesky.js';
import { activityPubProvider } from './providers/activitypub.js';
import { registerProvider } from './providers/registry.js';
import { accountsRouter } from './routes/accounts.js';
import { postsRouter } from './routes/posts.js';
import { sessionRouter } from './routes/session.js';

let initialized = false;

export async function createApp(): Promise<express.Application> {
    await initDb();
    if (!initialized) {
        registerProvider('bluesky', blueskyProvider);
        registerProvider('activitypub', activityPubProvider);
        runMigrations();
        initialized = true;
    }

    const app = express();
    app.use(express.json({ limit: '1mb' }));

    app.get('/health', (_req, res) => {
        res.json({ ok: true });
    });

    app.use('/api/session', sessionRouter);
    app.use('/api/accounts', accountsRouter);
    app.use('/api/posts', postsRouter);

    app.use(
        (
            err: Error,
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction,
        ) => {
            console.error('[multiverse] unhandled error:', err.message);
            res.status(500).json({ error: 'Internal server error' });
        },
    );

    return app;
}
