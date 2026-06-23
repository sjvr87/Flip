import { getAgent } from './agent';

export async function videoLike(uri: string): Promise<{ has_liked: boolean; likes: number }> {
    const agent = getAgent();
    const posts = await agent.getPosts({ uris: [uri] });
    const post = posts.data.posts[0];
    if (!post) throw new Error('Post not found');

    await agent.like(post.uri, post.cid);

    return {
        has_liked: true,
        likes: (post.likeCount ?? 0) + 1,
    };
}

export async function videoUnlike(uri: string): Promise<{ has_liked: boolean; likes: number }> {
    const agent = getAgent();
    const posts = await agent.getPosts({ uris: [uri] });
    const post = posts.data.posts[0];
    if (!post) throw new Error('Post not found');

    const likeUri = post.viewer?.like;
    if (likeUri) {
        await agent.deleteLike(likeUri);
    }

    return {
        has_liked: false,
        likes: Math.max(0, (post.likeCount ?? 1) - 1),
    };
}

export async function videoBookmark(uri: string): Promise<{ has_bookmarked: boolean }> {
    const agent = getAgent();
    try {
        await agent.app.bsky.bookmark.create({ uri });
        return { has_bookmarked: true };
    } catch {
        return { has_bookmarked: true };
    }
}

export async function videoUnbookmark(uri: string): Promise<{ has_bookmarked: boolean }> {
    const agent = getAgent();
    try {
        await agent.app.bsky.bookmark.delete({ uri });
    } catch {
        // bookmark API may be unavailable on some PDS versions
    }
    return { has_bookmarked: false };
}

export async function videoRepost(uri: string): Promise<{ has_reposted: boolean; shares: number }> {
    const agent = getAgent();
    const posts = await agent.getPosts({ uris: [uri] });
    const post = posts.data.posts[0];
    if (!post) throw new Error('Post not found');

    await agent.repost(post.uri, post.cid);

    return {
        has_reposted: true,
        shares: (post.repostCount ?? 0) + 1,
    };
}

export async function videoUnrepost(
    uri: string,
): Promise<{ has_reposted: boolean; shares: number }> {
    const agent = getAgent();
    const posts = await agent.getPosts({ uris: [uri] });
    const post = posts.data.posts[0];
    if (!post) throw new Error('Post not found');

    const repostUri = post.viewer?.repost;
    if (repostUri) {
        await agent.deleteRepost(repostUri);
    }

    return {
        has_reposted: false,
        shares: Math.max(0, (post.repostCount ?? 1) - 1),
    };
}
