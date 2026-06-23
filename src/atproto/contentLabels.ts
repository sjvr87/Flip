import type { AppBskyFeedDefs } from '@atproto/api';

/** Bluesky global label values for adult / graphic content. */
export const ADULT_CONTENT_LABELS = new Set([
    'porn',
    'sexual',
    'nudity',
    'graphic-media',
    'gore',
    '!hide',
    '!no-unauthenticated',
]);

type LabelLike = { val?: string; neg?: boolean };

function pushLabelVals(target: string[], labels: LabelLike[] | undefined) {
    if (!labels) return;
    for (const label of labels) {
        if (!label.neg && label.val) {
            target.push(label.val);
        }
    }
}

function collectLabelVals(post: AppBskyFeedDefs.PostView): string[] {
    const vals: string[] = [];

    pushLabelVals(vals, post.labels as LabelLike[] | undefined);

    const record = post.record as {
        labels?: { values?: LabelLike[] };
    };
    pushLabelVals(vals, record.labels?.values);

    const author = post.author as { labels?: LabelLike[] };
    pushLabelVals(vals, author.labels);

    const embed = post.embed;
    if (embed?.$type === 'app.bsky.embed.recordWithMedia#view' && 'record' in embed) {
        const recordView = embed.record as { labels?: LabelLike[] } | undefined;
        pushLabelVals(vals, recordView?.labels);
    }

    if (embed?.$type === 'app.bsky.embed.record#view' && 'labels' in embed) {
        pushLabelVals(vals, (embed as { labels?: LabelLike[] }).labels);
    }

    return vals;
}

export function hasAdultLabels(post: AppBskyFeedDefs.PostView): boolean {
    return collectLabelVals(post).some((val) => ADULT_CONTENT_LABELS.has(val));
}

export function isSensitivePost(post: AppBskyFeedDefs.PostView): boolean {
    return collectLabelVals(post).some((val) => ADULT_CONTENT_LABELS.has(val) || val === '!warn');
}

export function shouldHideAdultContent(): boolean {
    // Lazy import breaks authStore → adapters → contentLabels require cycle.
    const { useAuthStore } = require('@/utils/authStore') as typeof import('@/utils/authStore');
    return useAuthStore.getState().hideAdultContent ?? true;
}
