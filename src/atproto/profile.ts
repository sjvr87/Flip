import { AtUri, type AppBskyActorDefs } from '@atproto/api';
import { profileToFlipUser } from './adapters';
import { getAgent, withAuthenticatedFetch } from './agent';
import type { FlipUserProfile } from './types';

export type FlipAccountState = {
    following: boolean;
    blocking: boolean;
    pending_follow_request: boolean;
};

export type FlipFollowListItem = {
    id: string;
    username: string;
    name: string;
    avatar: string;
    is_following: boolean;
};

type FollowListPage = {
    data: FlipFollowListItem[];
    meta: { next_cursor: string | null };
};

function actorToFollowListItem(actor: AppBskyActorDefs.ProfileView): FlipFollowListItem {
    const profile = profileToFlipUser({
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName,
        avatar: actor.avatar,
        description: actor.description,
        postsCount: actor.postsCount,
        followersCount: actor.followersCount,
        followsCount: actor.followsCount,
    });

    return {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        avatar: profile.avatar,
        is_following: !!actor.viewer?.following,
    };
}

function normalizeFollowCursor(pageParam: string | false | undefined): string | undefined {
    if (!pageParam || pageParam === '0') return undefined;
    return pageParam;
}

async function resolveActorDid(actor: string): Promise<string> {
    const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }));
    return profile.data.did;
}

export async function fetchAccount(actor: string): Promise<{ data: FlipUserProfile }> {
    const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }));
    const isOwner = profile.data.did === getAgent().session?.did;

    return { data: profileToFlipUser(profile.data, isOwner) };
}

export async function fetchAccountState(actor: string): Promise<{ data: FlipAccountState }> {
    const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }));
    const viewer = profile.data.viewer;

    return {
        data: {
            following: !!viewer?.following,
            blocking: !!viewer?.blocking,
            pending_follow_request: false,
        },
    };
}

export async function followAccount(actor: string): Promise<{ data: Record<string, never> }> {
    const did = await resolveActorDid(actor);
    await withAuthenticatedFetch(() => getAgent().follow(did));
    return { data: {} };
}

export async function unfollowAccount(actor: string): Promise<{ data: Record<string, never> }> {
    const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }));
    const followUri = profile.data.viewer?.following;

    if (followUri) {
        await withAuthenticatedFetch(() => getAgent().deleteFollow(followUri));
    }

    return { data: {} };
}

export async function cancelFollowRequest(
    _actor: string,
): Promise<{ data: Record<string, never> }> {
    return { data: {} };
}

export async function blockAccount(actor: string): Promise<{ data: Record<string, never> }> {
    const did = await resolveActorDid(actor);
    const repo = getAgent().session!.did;

    await withAuthenticatedFetch(() =>
        getAgent().app.bsky.graph.block.create(
            { repo },
            {
                subject: did,
                createdAt: new Date().toISOString(),
            },
        ),
    );

    return { data: {} };
}

export async function fetchAccountFollowers({
    queryKey,
    pageParam = false,
}: {
    queryKey: unknown[];
    pageParam?: string | false;
}): Promise<FollowListPage> {
    const actor = queryKey[1] as string;

    const res = await withAuthenticatedFetch(() =>
        getAgent().app.bsky.graph.getFollowers({
            actor,
            limit: 30,
            cursor: normalizeFollowCursor(pageParam),
        }),
    );

    return {
        data: res.data.followers.map(actorToFollowListItem),
        meta: { next_cursor: res.data.cursor ?? null },
    };
}

export async function fetchAccountFollowing({
    queryKey,
    pageParam = false,
}: {
    queryKey: unknown[];
    pageParam?: string | false;
}): Promise<FollowListPage> {
    const actor = queryKey[1] as string;

    const res = await withAuthenticatedFetch(() =>
        getAgent().app.bsky.graph.getFollows({
            actor,
            limit: 30,
            cursor: normalizeFollowCursor(pageParam),
        }),
    );

    return {
        data: res.data.follows.map(actorToFollowListItem),
        meta: { next_cursor: res.data.cursor ?? null },
    };
}

export async function unblockAccount(actor: string): Promise<{ data: Record<string, never> }> {
    const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }));
    const blockUri = profile.data.viewer?.blocking;

    if (blockUri) {
        const { rkey } = new AtUri(blockUri);
        const repo = getAgent().session!.did;
        if (rkey) {
            await withAuthenticatedFetch(() =>
                getAgent().app.bsky.graph.block.delete({
                    repo,
                    rkey,
                }),
            );
        }
    }

    return { data: {} };
}
