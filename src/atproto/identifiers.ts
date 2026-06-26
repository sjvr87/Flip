const BLUESKY_PDS_HOSTS = new Set(['bsky.social', 'staging.bsky.dev', 'staging.flip.app']);
const BSKY_SOCIAL_SUFFIX = '.bsky.social';

/** Display username: strip `.bsky.social` only; keep custom domains (e.g. `user.com`) intact. */
export function handleToUsername(handle: string): string {
    const trimmed = handle.trim();
    if (trimmed.toLowerCase().endsWith(BSKY_SOCIAL_SUFFIX)) {
        return trimmed.slice(0, trimmed.length - BSKY_SOCIAL_SUFFIX.length);
    }
    return trimmed;
}

/** Short alias for bsky.social handles only (follow matching); null for custom domains. */
export function handleShortAlias(handle: string): string | null {
    const username = handleToUsername(handle);
    return username !== handle.trim() ? username : null;
}

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
        id = `${id}${BSKY_SOCIAL_SUFFIX}`;
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
