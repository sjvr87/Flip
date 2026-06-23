import type { AppBskyActorDefs } from '@atproto/api';

import { isVideoPost, postToFlipVideo, profileToFlipUser } from './adapters';
import { getAgent } from './agent';
import type { FlipVideo } from './types';

type SearchTab = 'Top' | 'Users' | 'Videos' | 'Hashtags';

export type SearchUser = {
    id: string;
    username: string;
    name: string;
    avatar: string;
    follower_count: number;
    post_count: number;
    is_following: boolean;
};

export type SearchHashtag = {
    id: number;
    name: string;
    slug: string;
    count: number;
    created_at: string;
};

export type SearchResult = {
    users: SearchUser[];
    videos: FlipVideo[];
    hashtags: SearchHashtag[];
};

function hashTagId(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash << 5) - hash + name.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function actorToSearchUser(actor: AppBskyActorDefs.ProfileView): SearchUser {
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
        follower_count: profile.follower_count,
        post_count: profile.post_count,
        is_following: !!actor.viewer?.following,
    };
}

function extractHashtagsFromQuery(query: string): string[] {
    const tags = new Set<string>();
    const matches = query.match(/#([\w]+)/g);
    if (matches) {
        for (const match of matches) {
            tags.add(match.replace(/^#/, '').toLowerCase());
        }
    }
    return [...tags];
}

async function searchUsers(q: string, limit: number): Promise<SearchUser[]> {
    const agent = getAgent();
    const res = await agent.searchActors({ q, limit });
    return res.data.actors.map(actorToSearchUser);
}

async function searchVideos(q: string, limit: number): Promise<FlipVideo[]> {
    const agent = getAgent();
    const tags = extractHashtagsFromQuery(q);
    const tag = tags[0];
    const res = await agent.app.bsky.feed.searchPosts({
        q: tag ? tag : q,
        tag,
        limit: Math.min(limit * 2, 50),
    });

    return res.data.posts
        .filter(isVideoPost)
        .slice(0, limit)
        .map((post) => postToFlipVideo({ post, reply: undefined }))
        .filter((v): v is FlipVideo => v !== null);
}

async function searchHashtags(q: string, limit: number): Promise<SearchHashtag[]> {
    const cleaned = q.replace(/^#/, '').trim();
    if (!cleaned) return [];

    const agent = getAgent();
    const res = await agent.app.bsky.feed.searchPosts({
        q: cleaned,
        tag: cleaned,
        limit: 1,
    });

    const now = new Date().toISOString();
    return [
        {
            id: hashTagId(cleaned),
            name: cleaned,
            slug: cleaned,
            count: res.data.posts.length > 0 ? res.data.posts.length : 0,
            created_at: now,
        },
    ].slice(0, limit);
}

export async function searchContent(params: {
    query: string;
    type: SearchTab;
    limit?: number;
}): Promise<SearchResult> {
    const q = params.query.trim().replace(/^#/, '');
    const limit = params.limit ?? 20;

    if (!q) {
        return { users: [], videos: [], hashtags: [] };
    }

    switch (params.type) {
        case 'Users':
            return { users: await searchUsers(q, limit), videos: [], hashtags: [] };
        case 'Videos':
            return { users: [], videos: await searchVideos(q, limit), hashtags: [] };
        case 'Hashtags':
            return { users: [], videos: [], hashtags: await searchHashtags(q, limit) };
        default: {
            const [users, videos, hashtags] = await Promise.all([
                searchUsers(q, Math.min(limit, 5)),
                searchVideos(q, Math.min(limit, 10)),
                searchHashtags(q, 3),
            ]);
            return { users, videos, hashtags };
        }
    }
}
