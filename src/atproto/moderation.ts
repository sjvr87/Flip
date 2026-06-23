import { BSKY_LABELER_DID, XRPCError } from '@atproto/api';

import { getAgent, SessionExpiredError, withAuthenticatedFetch } from './agent';

export type AtprotoReportRule = {
    key: string;
    message: string;
    requires_details?: boolean;
    reasonType: string;
};

/** Static report reasons — no Loops API. Keys map to ATProto moderation reasonType. */
const REPORT_RULES: AtprotoReportRule[] = [
    {
        key: 'spam',
        message: 'Spam or scam',
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
    },
    {
        key: 'misinformation',
        message: 'Misinformation',
        reasonType: 'com.atproto.moderation.defs#reasonMisleading',
    },
    {
        key: 'harassment',
        message: 'Harassment or bullying',
        reasonType: 'com.atproto.moderation.defs#reasonRude',
    },
    {
        key: 'sexual',
        message: 'Unwanted sexual content',
        reasonType: 'com.atproto.moderation.defs#reasonSexual',
    },
    {
        key: 'rules',
        message: 'Violates server rules',
        reasonType: 'com.atproto.moderation.defs#reasonViolation',
    },
    {
        key: 'other',
        message: 'Something else',
        reasonType: 'com.atproto.moderation.defs#reasonOther',
        requires_details: true,
    },
];

const REASON_BY_KEY = Object.fromEntries(REPORT_RULES.map((rule) => [rule.key, rule]));

export async function fetchReportRules(): Promise<
    { key: string; message: string; requires_details?: boolean }[]
> {
    return REPORT_RULES.map(({ key, message, requires_details }) => ({
        key,
        message,
        ...(requires_details ? { requires_details } : {}),
    }));
}

function formatReportError(error: unknown): string {
    if (error instanceof SessionExpiredError) {
        return error.message;
    }

    if (error instanceof XRPCError) {
        const detail = error.message?.trim() || error.error;
        if (
            error.status === 401 ||
            error.error === 'ExpiredToken' ||
            error.error === 'AuthMissing'
        ) {
            return 'Session expired — sign in again';
        }
        if (detail) {
            console.warn('[moderation] createReport failed:', {
                status: error.status,
                error: error.error,
                message: error.message,
            });
            return `Report failed: ${detail}`;
        }
        return 'Report failed. Please try again.';
    }

    if (error instanceof Error && error.message) {
        console.warn('[moderation] createReport failed:', error.message);
        return error.message;
    }

    return 'Failed to submit report. Please try again.';
}

async function resolveRecordRef(
    uri: string,
    cid?: string | null,
): Promise<{ uri: string; cid: string }> {
    if (!uri?.startsWith('at://')) {
        throw new Error('Cannot report this content: invalid post reference.');
    }

    const trimmedCid = cid?.trim();
    if (trimmedCid) {
        return { uri, cid: trimmedCid };
    }

    const agent = getAgent();
    const res = await agent.getPosts({ uris: [uri] });
    const post = res.data.posts[0];
    if (!post?.cid) {
        throw new Error(
            'Cannot report this post: missing content reference (cid). Refresh the feed and try again.',
        );
    }

    return { uri: post.uri, cid: post.cid };
}

export async function submitReport({
    id,
    cid,
    key,
    type,
    comment,
}: {
    id: string;
    cid?: string | null;
    key: string;
    type: string;
    comment?: string | null;
}) {
    const rule = REASON_BY_KEY[key];
    if (!rule) throw new Error('Invalid report reason');

    return withAuthenticatedFetch(async () => {
        const agent = getAgent();

        if (type === 'profile' && !id?.startsWith('did:')) {
            throw new Error('Cannot report this account: invalid profile reference.');
        }

        const subject =
            type === 'profile'
                ? {
                      $type: 'com.atproto.admin.defs#repoRef' as const,
                      did: id,
                  }
                : {
                      $type: 'com.atproto.repo.strongRef' as const,
                      ...(await resolveRecordRef(id, cid)),
                  };

        try {
            await agent
                .withProxy('atproto_labeler', BSKY_LABELER_DID)
                .com.atproto.moderation.createReport({
                    reasonType: rule.reasonType,
                    subject,
                    reason: comment?.trim() || undefined,
                    modTool: {
                        name: 'flip-app',
                    },
                });
        } catch (error) {
            throw new Error(formatReportError(error));
        }

        return { success: true };
    });
}
