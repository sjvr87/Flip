import {
    parseRepoDidFromAtUri,
    toProfileFeedPath,
    toProfilePath,
} from '@/utils/profileNavigation'

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
        const profileId = parseRepoDidFromAtUri(item.video_id) || item.video_pid
        if (profileId) {
            return toProfileFeedPath(item.video_id, profileId, {
                openComments: COMMENT_ACTIVITY_TYPES.has(item.type),
            })
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
    if (route) {
        router.push(route)
    }
}
