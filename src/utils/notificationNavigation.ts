import {
    parseRepoDidFromAtUri,
    toPostViewPath,
    toProfileFeedPath,
    toProfilePath,
} from '@/utils/profileNavigation'
import { usesAtprotoBackend } from '@/utils/requests'

const COMMENT_ACTIVITY_TYPES = new Set([
    'video.comment',
    'video.commentReply',
    'comment.like',
    'comment.share',
    'commentReply.like',
    'commentReply.share',
])

type NotificationNavItem = {
    type: string
    video_id?: string
    video_pid?: string
    actor?: { id?: string }
    kit?: { id?: string | number; path?: string }
}

export type NotificationRoute =
    | ReturnType<typeof toPostViewPath>
    | ReturnType<typeof toProfileFeedPath>
    | ReturnType<typeof toProfilePath>
    | string

export function getNotificationRoute(item: NotificationNavItem): NotificationRoute | null {
    if (item.type === 'starterKit.awaitingApproval' && item.kit?.id != null) {
        return `/private/notifications/starterKits/review/${item.kit.id}`
    }

    if (item.kit?.path && item.kit?.id != null) {
        return `/private/kits/show/${item.kit.id}`
    }

    if (item.video_id) {
        const openComments = COMMENT_ACTIVITY_TYPES.has(item.type)

        if (usesAtprotoBackend()) {
            return toPostViewPath(item.video_id, { openComments })
        }

        // Legacy REST backend — profile feed pagination.
        const profileId = item.video_pid || parseRepoDidFromAtUri(item.video_id)
        if (profileId) {
            return toProfileFeedPath(item.video_id, profileId, { openComments })
        }
    }

    if (item.actor?.id) {
        return toProfilePath(item.actor.id)
    }

    return null
}

/** @deprecated Use getNotificationRoute */
export function getNotificationHref(item: NotificationNavItem): NotificationRoute | null {
    return getNotificationRoute(item)
}

export function navigateFromNotification(
    router: { push: (href: NotificationRoute) => void },
    item: NotificationNavItem,
) {
    const route = getNotificationRoute(item)
    if (__DEV__) {
        console.log('[notification] tap', {
            type: item.type,
            video_id: item.video_id,
            video_pid: item.video_pid,
            route,
        })
    }
    if (route) {
        router.push(route)
    }
}
