import { getAgent, withAuthenticatedFetch } from './agent';

/**
 * Flip profile social preferences — private follower lists and Top 8 friends.
 * Lexicon: flip.social.profilePrefs (Phase 1 — read/write stubs for UI wiring).
 */
export const PROFILE_PREFS_COLLECTION = 'flip.social.profilePrefs';
export const PROFILE_PREFS_RKEY = 'self';

export type FlipProfilePrefs = {
    /** When true, followers list is hidden from viewers who are not the owner. */
    hideFollowersList?: boolean;
    /** When true, following list is hidden from viewers who are not the owner. */
    hideFollowingList?: boolean;
    /** Ordered DIDs/handles for MySpace-style Top 8 (max 8). */
    topFriends?: string[];
    updatedAt?: string;
};

type ProfilePrefsRecord = FlipProfilePrefs & { $type?: string };

const MAX_TOP_FRIENDS = 8;

function sanitizeTopFriends(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const ids = value
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        .slice(0, MAX_TOP_FRIENDS);
    return ids.length > 0 ? ids : undefined;
}

function fromRecord(value: ProfilePrefsRecord | null | undefined): FlipProfilePrefs | null {
    if (!value) return null;

    const topFriends = sanitizeTopFriends(value.topFriends);
    const hasContent =
        value.hideFollowersList === true ||
        value.hideFollowingList === true ||
        (topFriends?.length ?? 0) > 0;

    if (!hasContent) return null;

    return {
        hideFollowersList: value.hideFollowersList === true ? true : undefined,
        hideFollowingList: value.hideFollowingList === true ? true : undefined,
        topFriends,
        updatedAt: value.updatedAt,
    };
}

/** Read profile social prefs from the actor's repo (null when unset). */
export async function fetchProfilePrefs(actorDid: string): Promise<FlipProfilePrefs | null> {
    try {
        const res = await withAuthenticatedFetch(() =>
            getAgent().com.atproto.repo.getRecord({
                repo: actorDid,
                collection: PROFILE_PREFS_COLLECTION,
                rkey: PROFILE_PREFS_RKEY,
            }),
        );
        return fromRecord(res.data.value as ProfilePrefsRecord);
    } catch {
        return null;
    }
}

/** Persist profile social prefs on the signed-in user's repo. */
export async function saveProfilePrefs(
    patch: Partial<
        Pick<FlipProfilePrefs, 'hideFollowersList' | 'hideFollowingList' | 'topFriends'>
    >,
): Promise<FlipProfilePrefs> {
    const repo = getAgent().session?.did;
    if (!repo) throw new Error('Not authenticated');

    const existing = (await fetchProfilePrefs(repo)) ?? {};

    const record: ProfilePrefsRecord = {
        $type: PROFILE_PREFS_COLLECTION,
        hideFollowersList:
            'hideFollowersList' in patch
                ? patch.hideFollowersList === true
                    ? true
                    : undefined
                : existing.hideFollowersList,
        hideFollowingList:
            'hideFollowingList' in patch
                ? patch.hideFollowingList === true
                    ? true
                    : undefined
                : existing.hideFollowingList,
        topFriends:
            'topFriends' in patch ? sanitizeTopFriends(patch.topFriends) : existing.topFriends,
        updatedAt: new Date().toISOString(),
    };

    const hasContent =
        record.hideFollowersList === true ||
        record.hideFollowingList === true ||
        (record.topFriends?.length ?? 0) > 0;

    await withAuthenticatedFetch(() => {
        if (!hasContent) {
            return getAgent().com.atproto.repo.deleteRecord({
                repo,
                collection: PROFILE_PREFS_COLLECTION,
                rkey: PROFILE_PREFS_RKEY,
            });
        }
        return getAgent().com.atproto.repo.putRecord({
            repo,
            collection: PROFILE_PREFS_COLLECTION,
            rkey: PROFILE_PREFS_RKEY,
            record,
        });
    });

    return fromRecord(record) ?? {};
}

/** Whether the viewer may open followers/following lists for this profile. */
export function canViewFollowLists(
    prefs: FlipProfilePrefs | null | undefined,
    list: 'followers' | 'following',
    isOwner: boolean,
): boolean {
    if (isOwner) return true;
    if (!prefs) return true;
    if (list === 'followers' && prefs.hideFollowersList) return false;
    if (list === 'following' && prefs.hideFollowingList) return false;
    return true;
}
