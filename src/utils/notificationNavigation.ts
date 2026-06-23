import { resolveNotificationTapTarget } from '@/atproto/notifications';
import {
    parseRepoDidFromAtUri,
    toPostViewPath,
    toProfileFeedPath,
    toProfilePath,
} from '@/utils/profileNavigation';
import { usesAtprotoBackend } from '@/utils/requests';

const COMMENT_ACTIVITY_TYPES = new Set([
    'video.comment',
    'video.commentReply',
    'comment.like',
    'comment.share',
    'commentReply.like',
    'commentReply.share',
]);

/** Notification types that must open the referenced video/post, never the actor profile. */
const MEDIA_NOTIFICATION_TYPES = new Set([
    'video.like',
    'video.comment',
    'video.commentReply',
    'video.share',
    'video.duet',
    'video.mention',
    'comment.like',
    'comment.share',
    'commentReply.like',
    'commentReply.share',
]);

type NotificationNavItem = {
    id?: string;
    type: string;
    video_id?: string;
    video_pid?: string;
    actor?: { id?: string };
    kit?: { id?: string | number; path?: string };
};

export type NotificationRoute =
    | ReturnType<typeof toPostViewPath>
    | ReturnType<typeof toProfileFeedPath>
    | ReturnType<typeof toProfilePath>
    | string;

export function getNotificationRoute(item: NotificationNavItem): NotificationRoute | null {
    if (item.type === 'starterKit.awaitingApproval' && item.kit?.id != null) {
        return `/private/notifications/starterKits/review/${item.kit.id}`;
    }

    if (item.kit?.path && item.kit?.id != null) {
        return `/private/kits/show/${item.kit.id}`;
    }

    if (item.video_id) {
        const openComments = COMMENT_ACTIVITY_TYPES.has(item.type);

        if (usesAtprotoBackend()) {
            return toPostViewPath(item.video_id, { openComments });
        }

        // Legacy REST backend — profile feed pagination.
        const profileId = item.video_pid || parseRepoDidFromAtUri(item.video_id);
        if (profileId) {
            return toProfileFeedPath(item.video_id, profileId, { openComments });
        }
    }

    if (item.actor?.id) {
        return toProfilePath(item.actor.id);
    }

    return null;
}

/** @deprecated Use getNotificationRoute */
export function getNotificationHref(item: NotificationNavItem): NotificationRoute | null {
    return getNotificationRoute(item);
}

export async function navigateFromNotification(
    router: { push: (href: NotificationRoute) => void },
    item: NotificationNavItem,
) {
    if (item.type === 'starterKit.awaitingApproval' && item.kit?.id != null) {
        router.push(`/private/notifications/starterKits/review/${item.kit.id}`);
        return;
    }

    if (item.kit?.path && item.kit?.id != null) {
        router.push(`/private/kits/show/${item.kit.id}`);
        return;
    }

    if (MEDIA_NOTIFICATION_TYPES.has(item.type)) {
        if (usesAtprotoBackend()) {
            const target = await resolveNotificationTapTarget({
                id: item.id ?? '',
                type: item.type,
                video_id: item.video_id,
                video_pid: item.video_pid,
            });

            if (target) {
                const route = toPostViewPath(target.postUri, {
                    openComments: target.openComments,
                });
                if (__DEV__) {
                    console.log('[notification] tap → post viewer', {
                        type: item.type,
                        postUri: target.postUri,
                        openComments: target.openComments,
                        route,
                    });
                }
                router.push(route);
                return;
            }

            if (__DEV__) {
                console.warn('[notification] tap: no post target for media notification', {
                    type: item.type,
                    video_id: item.video_id,
                    id: item.id,
                });
            }
            return;
        }

        if (item.video_id) {
            const profileId = item.video_pid || parseRepoDidFromAtUri(item.video_id);
            if (profileId) {
                const openComments = COMMENT_ACTIVITY_TYPES.has(item.type);
                router.push(toProfileFeedPath(item.video_id, profileId, { openComments }));
                return;
            }
        }

        return;
    }

    const route = getNotificationRoute(item);
    if (__DEV__) {
        console.log('[notification] tap', {
            type: item.type,
            video_id: item.video_id,
            video_pid: item.video_pid,
            route,
        });
    }
    if (route) {
        router.push(route);
    }
}
