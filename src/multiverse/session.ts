import { Storage } from '@/utils/cache';
import { getMultiverseApiBase } from './config';

const SESSION_KEY = 'flip.multiverse.session';

type StoredSession = {
    token: string;
    userId: string;
    did: string;
};

export function getMultiverseToken(): string | null {
    const raw = Storage.getString(SESSION_KEY);
    if (!raw) return null;
    try {
        return (JSON.parse(raw) as StoredSession).token;
    } catch {
        return null;
    }
}

export function clearMultiverseSession(): void {
    Storage.delete(SESSION_KEY);
}

export async function ensureMultiverseSession(
    did: string,
    handle?: string | null,
): Promise<string> {
    const existing = getMultiverseToken();
    if (existing) return existing;

    const base = getMultiverseApiBase();
    const resp = await fetch(`${base}/api/session/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ did, handle: handle ?? undefined }),
    });

    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new Error(body?.error ?? `Session bootstrap failed (${resp.status})`);
    }

    const payload: StoredSession = {
        token: body.token,
        userId: body.user?.id,
        did: body.user?.did ?? did,
    };
    Storage.set(SESSION_KEY, JSON.stringify(payload));
    return payload.token;
}

async function multiverseFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const base = getMultiverseApiBase();
    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(init.headers as Record<string, string>),
    };
    if (init.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(`${base}${path}`, { ...init, headers });
}

export async function authedMultiverseFetch(
    path: string,
    token: string,
    init: RequestInit = {},
): Promise<Response> {
    return multiverseFetch(path, {
        ...init,
        headers: {
            ...(init.headers as Record<string, string>),
            Authorization: `Bearer ${token}`,
        },
    });
}
