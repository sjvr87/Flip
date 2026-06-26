import { Router } from 'express';
import { bootstrapSession } from '../auth/sessions.js';

export const sessionRouter = Router();

/** Bootstrap a Flip multiverse API session from the client's primary DID. */
sessionRouter.post('/bootstrap', (req, res) => {
    const did = String(req.body?.did ?? '').trim();
    const handle = req.body?.handle ? String(req.body.handle).trim() : undefined;

    if (!did.startsWith('did:')) {
        res.status(400).json({ error: 'did is required (ATProto DID)' });
        return;
    }

    const { token, user } = bootstrapSession(did, handle);
    res.json({
        token,
        user: { id: user.id, did: user.did, handle: user.handle },
    });
});
