import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { dbAll, dbGet, dbRun } from '../db/client.js';
import type { UserRow } from '../types.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function bootstrapSession(did: string, handle?: string): { token: string; user: UserRow } {
    let user = dbGet<UserRow>('SELECT * FROM users WHERE did = ?', [did]);

    if (!user) {
        const id = randomUUID();
        dbRun('INSERT INTO users (id, did, handle) VALUES (?, ?, ?)', [
            id,
            did,
            handle ?? null,
        ]);
        user = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])!;
    } else if (handle && user.handle !== handle) {
        dbRun('UPDATE users SET handle = ? WHERE id = ?', [handle, user.id]);
        user = { ...user, handle };
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    dbRun('INSERT INTO flip_sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [
        token,
        user.id,
        expiresAt,
    ]);

    return { token, user };
}

export function resolveSession(token: string): UserRow | null {
    const row = dbGet<UserRow>(
        `SELECT u.* FROM flip_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`,
        [token],
    );
    return row ?? null;
}

export type AuthedRequest = Request & { flipUser?: UserRow };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }
    const token = header.slice('Bearer '.length).trim();
    const user = resolveSession(token);
    if (!user) {
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
    }
    req.flipUser = user;
    next();
}
