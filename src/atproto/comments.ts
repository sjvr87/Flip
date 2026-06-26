import type { AppBskyFeedDefs } from '@atproto/api';
import { getAgent } from './agent';
import { handleToUsername } from './identifiers';
import type { FlipAccount } from './types';
import { extractMentionsFromRecord, extractTagsFromRecord } from './mentions';

const PAGE_SIZE = 20;

export type FlipComment = {
    id: string;
    account: FlipAccount;
    caption: string;
    tags: string[];
    mentions: ReturnType<typeof extractMentionsFromRecord>;
    created_at: string;
    likes: number;
    liked: boolean;
    replies: number;
    is_owner: boolean;
    p_id?: string;
    media?: unknown[];
};

type CommentPage = {
    data: FlipComment[];
    meta: { next_cursor: string | null; path: string; per_page: number };
};

function isThreadViewPost(
    thread:
        | AppBskyFeedDefs.ThreadViewPost
        | AppBskyFeedDefs.NotFoundPost
        | AppBskyFeedDefs.BlockedPost,
): thread is AppBskyFeedDefs.ThreadViewPost {
    return thread.$type === 'app.bsky.feed.defs#threadViewPost';
}

function toAccount(author: AppBskyFeedDefs.PostView['author']): FlipAccount {
    const handle = author.handle || author.did;
    const username = handleToUsername(handle);

    return {
        id: author.did,
        name: author.displayName || handle,
        avatar: author.avatar || '',
        username,
        url: `https://bsky.app/profile/${handle}`,
    };
}

function postToComment(post: AppBskyFeedDefs.PostView, parentId?: string): FlipComment {
    const agent = getAgent();
    const record = post.record as {
        text?: string;
        facets?: import('@atproto/api').RichText['facets'];
    };

    return {
        id: post.uri,
        account: toAccount(post.author),
        caption: record.text || '',
        tags: extractTagsFromRecord(record),
        mentions: extractMentionsFromRecord(record),
        created_at: (post.record as { createdAt?: string }).createdAt || new Date().toISOString(),
        likes: post.likeCount ?? 0,
        liked: !!post.viewer?.like,
        replies: post.replyCount ?? 0,
        is_owner: post.author.did === agent.session?.did,
        ...(parentId ? { p_id: parentId } : {}),
    };
}

function paginate<T>(
    items: T[],
    pageParam: string | null | false,
): { data: T[]; next_cursor: string | null } {
    const offset = pageParam ? Number(pageParam) : 0;
    const slice = items.slice(offset, offset + PAGE_SIZE);
    const next = offset + PAGE_SIZE < items.length ? String(offset + PAGE_SIZE) : null;
    return { data: slice, next_cursor: next };
}

async function getPostRef(uri: string): Promise<{ uri: string; cid: string }> {
    const agent = getAgent();
    const res = await agent.getPosts({ uris: [uri] });
    const post = res.data.posts[0];
    if (!post) throw new Error('Post not found');
    return { uri: post.uri, cid: post.cid };
}

function collectDirectReplies(thread: AppBskyFeedDefs.ThreadViewPost): FlipComment[] {
    const replies: FlipComment[] = [];

    for (const node of thread.replies ?? []) {
        if (!isThreadViewPost(node)) continue;
        replies.push(postToComment(node.post));
    }

    return replies;
}

export async function fetchVideoComments(
    videoUri: string,
    pageParam: string | null | false = null,
): Promise<CommentPage> {
    const agent = getAgent();
    const res = await agent.getPostThread({ uri: videoUri, depth: 6, parentHeight: 0 });

    if (!isThreadViewPost(res.data.thread)) {
        return { data: [], meta: { path: 'atproto', per_page: 0, next_cursor: null } };
    }

    const all = collectDirectReplies(res.data.thread);
    const { data, next_cursor } = paginate(all, pageParam);

    return {
        data,
        meta: { path: 'atproto', per_page: data.length, next_cursor },
    };
}

export async function fetchVideoReplies(
    videoUri: string,
    parentCommentUri: string,
    pageParam: string | null | false = null,
): Promise<CommentPage> {
    const agent = getAgent();
    const res = await agent.getPostThread({ uri: parentCommentUri, depth: 6, parentHeight: 0 });

    if (!isThreadViewPost(res.data.thread)) {
        return { data: [], meta: { path: 'atproto', per_page: 0, next_cursor: null } };
    }

    const all = collectDirectReplies(res.data.thread).map((reply) => ({
        ...reply,
        p_id: parentCommentUri,
    }));
    const { data, next_cursor } = paginate(all, pageParam);

    return {
        data,
        meta: { path: 'atproto', per_page: data.length, next_cursor },
    };
}

export async function commentPost({
    id,
    commentText,
    parentId,
}: {
    id: string;
    commentText: string;
    parentId?: string;
}): Promise<{ data: FlipComment[] }> {
    const agent = getAgent();
    const root = await getPostRef(id);
    const parent = parentId ? await getPostRef(parentId) : root;

    const result = await agent.post({
        text: commentText,
        reply: { root, parent },
        createdAt: new Date().toISOString(),
    });

    const posts = await agent.getPosts({ uris: [result.uri] });
    const post = posts.data.posts[0];
    if (!post) throw new Error('Failed to load new comment');

    return {
        data: [postToComment(post, parentId ? parent.uri : undefined)],
    };
}

async function toggleCommentLike(
    commentUri: string,
    like: boolean,
): Promise<{ liked: boolean; likes: number }> {
    const agent = getAgent();
    const posts = await agent.getPosts({ uris: [commentUri] });
    const post = posts.data.posts[0];
    if (!post) throw new Error('Comment not found');

    if (like) {
        await agent.like(post.uri, post.cid);
        return { liked: true, likes: (post.likeCount ?? 0) + 1 };
    }

    const likeUri = post.viewer?.like;
    if (likeUri) {
        await agent.deleteLike(likeUri);
    }

    return { liked: false, likes: Math.max(0, (post.likeCount ?? 1) - 1) };
}

export async function commentLike({
    commentId,
}: {
    videoId: string;
    commentId: string;
}): Promise<{ liked: boolean; likes: number }> {
    return toggleCommentLike(commentId, true);
}

export async function commentUnlike({
    commentId,
}: {
    videoId: string;
    commentId: string;
}): Promise<{ liked: boolean; likes: number }> {
    return toggleCommentLike(commentId, false);
}

export async function commentReplyLike({
    commentId,
}: {
    videoId: string;
    parentId: string;
    commentId: string;
}): Promise<{ liked: boolean; likes: number }> {
    return toggleCommentLike(commentId, true);
}

export async function commentReplyUnlike({
    commentId,
}: {
    videoId: string;
    parentId: string;
    commentId: string;
}): Promise<{ liked: boolean; likes: number }> {
    return toggleCommentLike(commentId, false);
}

export async function commentDelete({
    commentId,
}: {
    videoId: string;
    commentId: string;
}): Promise<void> {
    const agent = getAgent();
    await agent.deletePost(commentId);
}

export async function commentReplyDelete({
    commentId,
}: {
    videoId: string;
    parentId: string;
    commentId: string;
}): Promise<void> {
    const agent = getAgent();
    await agent.deletePost(commentId);
}
