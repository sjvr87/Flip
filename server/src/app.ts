import express from 'express';
import { initDb, runMigrations } from './db/client.js';
import { atprotoProvider } from './providers/atproto.js';
import { activityPubProvider } from './providers/activitypub.js';
import { nostrProvider } from './providers/nostr.js';
import { isProviderFeatureEnabled, ProviderIds } from './config/providers.js';
import { registerProvider } from './providers/registry.js';
import { accountsRouter } from './routes/accounts.js';
import { postsRouter } from './routes/posts.js';
import { sessionRouter } from './routes/session.js';

let initialized = false;

export async function createApp(): Promise<express.Application> {
    await initDb();
    if (!initialized) {
        registerProvider(ProviderIds.ATPROTO, atprotoProvider);
        registerProvider(ProviderIds.NOSTR, nostrProvider);
        registerProvider(ProviderIds.ACTIVITYPUB, activityPubProvider);
        runMigrations();
        initialized = true;
    }

    const app = express();
    app.use(express.json({ limit: '1mb' }));

    app.get('/health', (_req, res) => {
        res.json({
            ok: true,
            providers: {
                atproto: isProviderFeatureEnabled(ProviderIds.ATPROTO),
                nostr: isProviderFeatureEnabled(ProviderIds.NOSTR),
                activitypub: isProviderFeatureEnabled(ProviderIds.ACTIVITYPUB),
            },
        });
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
