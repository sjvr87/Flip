import { toProfileFeedPath, toProfilePath } from '@/utils/profileNavigation'

const VIDEO_ACTIVITY_TYPES = new Set([
    'video.like',
    'video.comment',
    'video.commentReply',
    'video.mention',
    'video.share',
    'video.duet',
])

type NotificationNavItem = {
    type: string
    video_id?: string
    video_pid?: string
    actor?: { id?: string }
    kit?: { id?: string | number; path?: string }
}

export function getNotificationHref(item: NotificationNavItem): string | null {
    if (item.type === 'starterKit.awaitingApproval' && item.kit?.id != null) {
        return `/private/notifications/starterKits/review/${item.kit.id}`
    }

    if (item.kit?.path && item.kit?.id != null) {
        return `/private/kits/show/${item.kit.id}`
    }

    if (VIDEO_ACTIVITY_TYPES.has(item.type) && item.video_id && item.video_pid) {
        return toProfileFeedPath(item.video_id, item.video_pid)
    }

    if (item.actor?.id) {
        return toProfilePath(item.actor.id)
    }

    return null
}

export function navigateFromNotification(
    router: { push: (href: string) => void },
    item: NotificationNavItem,
) {
    const href = getNotificationHref(item)
    if (href) {
        router.push(href)
    }
}
