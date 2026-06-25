const BLUESKY_PDS_HOSTS = new Set(['bsky.social', 'staging.bsky.dev', 'staging.flip.app']);

/** Normalize handle, email, or DID for ATProto password login. */
export function normalizeBlueskyIdentifier(raw: string): string {
    let id = raw.trim();
    if (!id) return id;

    if (id.startsWith('@')) {
        id = id.slice(1);
    }

    if (id.startsWith('did:')) {
        return id;
    }

    if (id.includes('@')) {
        return id.toLowerCase();
    }

    id = id.toLowerCase();

    if (!id.includes('.')) {
        id = `${id}.bsky.social`;
    }

    return id;
}

/** True when the user entered a PDS hostname instead of their personal handle. */
export function looksLikePdsHostname(raw: string): boolean {
    const stripped = raw
        .trim()
        .toLowerCase()
        .replace(/^@/, '')
        .replace(/^https?:\/\//, '');
    const host = stripped.split('/')[0] ?? stripped;
    return BLUESKY_PDS_HOSTS.has(host);
}
