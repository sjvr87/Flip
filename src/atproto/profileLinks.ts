import { getAgent, withAuthenticatedFetch } from './agent';
import { Storage } from '@/utils/cache';

/** Flip profile links — stored as a single repo record per account. */
export const PROFILE_LINKS_COLLECTION = 'flip.social.profileLinks';
export const PROFILE_LINKS_RKEY = 'self';

const MAX_LINKS = 5;
const MIN_FOLLOWER_THRESHOLD = 0;
const CLICKS_KEY = 'flip.profileLinkClicks';

export type StoredProfileLink = {
    id: string;
    url: string;
    createdAt: string;
};

export type FlipProfileLinkRow = {
    id: string;
    url: string;
    url_pretty: string;
    created_at: string;
};

export type ProfileLinksPayload = {
    data: {
        id: string;
        min_threshold: number;
        total_allowed: number;
        available_slots: number;
        can_add: boolean;
        links: FlipProfileLinkRow[];
    };
};

type ProfileLinksRecord = {
    $type?: string;
    links?: StoredProfileLink[];
    updatedAt?: string;
};

type ClickMap = Record<string, number>;

function prettyUrl(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url.replace(/^https?:\/\//, '');
    }
}

function toRow(link: StoredProfileLink): FlipProfileLinkRow {
    return {
        id: link.id,
        url: link.url,
        url_pretty: prettyUrl(link.url),
        created_at: link.createdAt,
    };
}

function readClickMap(): ClickMap {
    try {
        const raw = Storage.getString(CLICKS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as ClickMap;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeClickMap(map: ClickMap): void {
    Storage.set(CLICKS_KEY, JSON.stringify(map));
}

function buildMeta(
    actorDid: string,
    links: StoredProfileLink[],
    followerCount = 0,
): ProfileLinksPayload {
    const thresholdMet = followerCount >= MIN_FOLLOWER_THRESHOLD;
    const totalAllowed = thresholdMet ? MAX_LINKS : 0;
    const availableSlots = Math.max(0, totalAllowed - links.length);

    return {
        data: {
            id: actorDid,
            min_threshold: MIN_FOLLOWER_THRESHOLD,
            total_allowed: totalAllowed,
            available_slots: availableSlots,
            can_add: thresholdMet && links.length < MAX_LINKS,
            links: links.map(toRow),
        },
    };
}

async function readLinksRecord(actorDid: string): Promise<StoredProfileLink[]> {
    try {
        const res = await withAuthenticatedFetch(() =>
            getAgent().com.atproto.repo.getRecord({
                repo: actorDid,
                collection: PROFILE_LINKS_COLLECTION,
                rkey: PROFILE_LINKS_RKEY,
            }),
        );
        const value = res.data.value as ProfileLinksRecord;
        const links = value?.links;
        if (!Array.isArray(links)) return [];
        return links.filter(
            (l): l is StoredProfileLink =>
                !!l &&
                typeof l.id === 'string' &&
                typeof l.url === 'string' &&
                typeof l.createdAt === 'string',
        );
    } catch {
        return [];
    }
}

async function writeLinksRecord(links: StoredProfileLink[]): Promise<void> {
    const repo = getAgent().session?.did;
    if (!repo) throw new Error('Not authenticated');

    await withAuthenticatedFetch(() =>
        getAgent().com.atproto.repo.putRecord({
            repo,
            collection: PROFILE_LINKS_COLLECTION,
            rkey: PROFILE_LINKS_RKEY,
            record: {
                $type: PROFILE_LINKS_COLLECTION,
                links,
                updatedAt: new Date().toISOString(),
            },
        }),
    );
}

/** Profile links for display on a profile card. */
export type ProfileDisplayLink = { id: string; link: string; url: string };

export async function fetchProfileDisplayLinks(actorDid: string): Promise<ProfileDisplayLink[]> {
    const links = await readLinksRecord(actorDid);
    return links.map((l) => ({ id: l.id, link: l.url, url: l.url }));
}

export async function getProfileLinksForSelf(): Promise<ProfileLinksPayload> {
    const agent = getAgent();
    const did = agent.session?.did;
    if (!did) throw new Error('Not authenticated');

    const profile = await withAuthenticatedFetch(() => agent.getProfile({ actor: did }));
    const links = await readLinksRecord(did);
    return buildMeta(did, links, profile.data.followersCount ?? 0);
}

export async function getProfileLinksForActor(actorDid: string): Promise<ProfileLinksPayload> {
    const links = await readLinksRecord(actorDid);
    let followerCount = 0;
    try {
        const profile = await withAuthenticatedFetch(() =>
            getAgent().getProfile({ actor: actorDid }),
        );
        followerCount = profile.data.followersCount ?? 0;
    } catch {
        followerCount = 0;
    }
    return buildMeta(actorDid, links, followerCount);
}

export async function addProfileLink(url: string): Promise<ProfileLinksPayload> {
    const trimmed = url.trim();
    if (!trimmed.startsWith('https://')) {
        throw new Error('URL must start with https://');
    }
    if (trimmed.length > 120) {
        throw new Error('URL must be 120 characters or less');
    }
    try {
        new URL(trimmed);
    } catch {
        throw new Error('Please enter a valid URL');
    }

    const meta = await getProfileLinksForSelf();
    if (!meta.data.can_add) {
        throw new Error('Cannot add more profile links');
    }

    const existing = await readLinksRecord(meta.data.id);
    if (existing.some((l) => l.url === trimmed)) {
        throw new Error('This link is already on your profile');
    }

    const next: StoredProfileLink[] = [
        ...existing,
        {
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
            url: trimmed,
            createdAt: new Date().toISOString(),
        },
    ];

    await writeLinksRecord(next);
    const profile = await withAuthenticatedFetch(() =>
        getAgent().getProfile({ actor: meta.data.id }),
    );
    return buildMeta(meta.data.id, next, profile.data.followersCount ?? 0);
}

export async function deleteProfileLink(linkId: string): Promise<ProfileLinksPayload> {
    const meta = await getProfileLinksForSelf();
    const existing = await readLinksRecord(meta.data.id);
    const next = existing.filter((l) => l.id !== linkId);
    if (next.length === existing.length) {
        throw new Error('Link not found');
    }
    await writeLinksRecord(next);
    const profile = await withAuthenticatedFetch(() =>
        getAgent().getProfile({ actor: meta.data.id }),
    );
    return buildMeta(meta.data.id, next, profile.data.followersCount ?? 0);
}

export async function fetchProfileLinkAnalytics(): Promise<{ data: { url: string; clicks: number }[] }> {
    const meta = await getProfileLinksForSelf();
    const clickMap = readClickMap();
    return {
        data: meta.data.links.map((l) => ({
            url: l.url,
            clicks: clickMap[l.url] ?? 0,
        })),
    };
}

/** Owner-only: increment local click counter (no server analytics on AT Proto). */
export function recordProfileLinkClick(url: string): void {
    const map = readClickMap();
    map[url] = (map[url] ?? 0) + 1;
    writeClickMap(map);
}
