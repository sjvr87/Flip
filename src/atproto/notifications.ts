import type { AppBskyNotificationDefs } from '@atproto/api'
import { AppBskyEmbedVideo } from '@atproto/api'

import { getAgent } from './agent'

export type FlipNotification = {
  id: string
  type: string
  video_pid?: string
  video_id?: string
  video_thumbnail?: string
  actor: {
    id: string
    name: string
    username: string
    avatar: string
  }
  url?: string
  read_at: string | null
  created_at: string
}

type UnreadCounts = {
  activity: number
  followers: number
  system: number
  starterKits: number
}

const ACTIVITY_REASONS = new Set(['like', 'reply', 'quote', 'repost', 'mention'])


function actorFromNotification(
  author: AppBskyNotificationDefs.Notification['author'],
): FlipNotification['actor'] {
  const handle = author.handle || author.did
  const username = handle.includes('.') ? handle.split('.')[0] : handle

  return {
    id: author.did,
    name: author.displayName || handle,
    username,
    avatar: author.avatar || '',
  }
}

function reasonToType(reason: string, reasonSubject?: string): string {
  switch (reason) {
    case 'follow':
      return 'new_follower'
    case 'like':
      return reasonSubject?.includes('app.bsky.feed.post') ? 'video.like' : 'comment.like'
    case 'reply':
      return 'video.comment'
    case 'quote':
      return 'video.comment'
    case 'repost':
      return 'video.share'
    case 'mention':
      return 'video.mention'
    default:
      return 'activity'
  }
}

function parseRepoDidFromUri(uri: string): string | undefined {
  const match = uri.match(/^at:\/\/(did:[^/]+)/)
  return match?.[1]
}

function extractVideoMeta(
  notification: AppBskyNotificationDefs.Notification,
): Pick<FlipNotification, 'video_id' | 'video_pid' | 'video_thumbnail'> {
  const subject = notification.reasonSubject
  if (!subject) return {}

  let videoThumbnail: string | undefined

  const embed = (notification as { reasonSubjectEmbed?: { media?: unknown } }).reasonSubjectEmbed
  if (
    embed &&
    typeof embed === 'object' &&
    embed !== null &&
    'media' in embed &&
    embed.media &&
    AppBskyEmbedVideo.isView(embed.media as AppBskyEmbedVideo.View)
  ) {
    videoThumbnail = (embed.media as AppBskyEmbedVideo.View).thumbnail || undefined
  }

  return {
    video_id: subject,
    video_pid: parseRepoDidFromUri(subject),
    video_thumbnail: videoThumbnail,
  }
}

function mapNotification(notification: AppBskyNotificationDefs.Notification): FlipNotification {
  const videoMeta = extractVideoMeta(notification)

  return {
    id: notification.uri,
    type: reasonToType(notification.reason, notification.reasonSubject),
    ...videoMeta,
    actor: actorFromNotification(notification.author),
    read_at: notification.isRead ? notification.indexedAt : null,
    created_at: notification.indexedAt,
  }
}

function matchesActivityFilter(
  notification: FlipNotification,
  filter: string,
): boolean {
  switch (filter) {
    case 'followers':
      return notification.type === 'new_follower'
    case 'videoLike':
      return notification.type === 'video.like'
    case 'videoShare':
      return notification.type === 'video.share'
    case 'comments':
      return notification.type === 'video.comment'
    case 'commentLike':
      return notification.type === 'comment.like'
    case 'commentShare':
      return notification.type === 'comment.share'
    case 'activity':
    default:
      return notification.type !== 'new_follower'
  }
}

function countUnread(notifications: FlipNotification[]): UnreadCounts {
  const unread = notifications.filter((n) => !n.read_at)
  return {
    activity: unread.filter((n) => n.type !== 'new_follower').length,
    followers: unread.filter((n) => n.type === 'new_follower').length,
    system: 0,
    starterKits: 0,
  }
}

async function listNotificationsPage(cursor?: string, limit = 30) {
  const agent = getAgent()
  const res = await agent.listNotifications({ limit, cursor })
  const mapped = res.data.notifications.map(mapNotification)
  return {
    notifications: mapped,
    cursor: res.data.cursor,
  }
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const agent = getAgent()
  if (!agent.session) return 0

  try {
    const res = await agent.countUnreadNotifications()
    return res.data.count ?? 0
  } catch {
    return 0
  }
}

export async function fetchNotifications({
  pageParam,
}: {
  pageParam?: string
} = {}): Promise<{ data: FlipNotification[]; meta: { unread_counts: UnreadCounts; next_cursor?: string | null } }> {
  const { notifications, cursor } = await listNotificationsPage(pageParam, 50)

  return {
    data: notifications,
    meta: {
      unread_counts: countUnread(notifications),
      next_cursor: cursor ?? null,
    },
  }
}

export async function fetchActivityNotifications({
  pageParam,
  type = 'activity',
}: {
  pageParam?: string
  type?: string
} = {}): Promise<{ data: FlipNotification[]; meta: { next_cursor: string | null } }> {
  const { notifications, cursor } = await listNotificationsPage(pageParam, 30)
  const filtered = notifications.filter((n) => matchesActivityFilter(n, type))

  return {
    data: filtered,
    meta: { next_cursor: cursor ?? null },
  }
}

export async function fetchFollowerNotifications({
  pageParam,
}: {
  pageParam?: string
} = {}): Promise<{ data: FlipNotification[]; meta: { next_cursor: string | null } }> {
  const { notifications, cursor } = await listNotificationsPage(pageParam, 30)
  const filtered = notifications.filter((n) => n.type === 'new_follower')

  return {
    data: filtered,
    meta: { next_cursor: cursor ?? null },
  }
}

export async function notificationMarkAsRead(id: string): Promise<{ data: Record<string, never> }> {
  const agent = getAgent()

  // Mark everything up to this notification as seen.
  const res = await agent.listNotifications({ limit: 50 })
  const target = res.data.notifications.find((n) => n.uri === id)
  const seenAt = target?.indexedAt ?? new Date().toISOString()

  await agent.updateSeenNotifications({ seenAt })
  return { data: {} }
}

export async function notificationTypeMarkAllAsRead(_type: string): Promise<{ data: Record<string, never> }> {
  const agent = getAgent()
  await agent.updateSeenNotifications({ seenAt: new Date().toISOString() })
  return { data: {} }
}
