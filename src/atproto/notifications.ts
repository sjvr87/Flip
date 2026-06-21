import type { AppBskyNotificationDefs } from '@atproto/api'
import { AppBskyEmbedVideo, AppBskyFeedLike, AppBskyFeedRepost } from '@atproto/api'

import { getAgent, SessionExpiredError, withAuthenticatedFetch } from './agent'
import { normalizeToPostUri } from './postResolve'
import { parseRepoDidFromAtUri } from '@/utils/profileNavigation'

const REPLY_NOTIFICATION_REASONS = new Set(['reply', 'quote', 'mention'])

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

/**
 * Match Bluesky social-app getSubjectUri — reasonSubject alone is wrong for
 * reposts (points at the repost record) and reply/quote/mention (use notif.uri).
 */
export function getNotificationSubjectUri(
  notification: AppBskyNotificationDefs.Notification,
): string | undefined {
  const reason = notification.reason

  if (
    reason === 'reply' ||
    reason === 'quote' ||
    reason === 'mention' ||
    reason === 'subscribed-post'
  ) {
    return notification.uri
  }

  if (
    reason === 'like' ||
    reason === 'repost' ||
    reason === 'like-via-repost' ||
    reason === 'repost-via-repost'
  ) {
    const record = notification.record
    if (AppBskyFeedRepost.isRecord(record) || AppBskyFeedLike.isRecord(record)) {
      const subjectUri = record.subject?.uri
      if (typeof subjectUri === 'string' && subjectUri.length > 0) {
        return subjectUri
      }
    }
    if (notification.reasonSubject?.includes('app.bsky.feed.post')) {
      return notification.reasonSubject
    }
    // Like/repost record URI — resolved to the post in fetchUserVideoCursor.
    if (notification.reasonSubject) {
      return notification.reasonSubject
    }
    return undefined
  }

  if (notification.reasonSubject?.includes('app.bsky.feed.post')) {
    return notification.reasonSubject
  }

  return notification.reasonSubject || undefined
}

function reasonToType(reason: string, subjectUri?: string): string {
  switch (reason) {
    case 'follow':
      return 'new_follower'
    case 'like':
    case 'like-via-repost':
      return subjectUri?.includes('app.bsky.feed.post') ? 'video.like' : 'comment.like'
    case 'reply':
      return 'video.comment'
    case 'quote':
      return 'video.comment'
    case 'repost':
    case 'repost-via-repost':
      return 'video.share'
    case 'mention':
      return 'video.mention'
    default:
      return 'activity'
  }
}

function extractVideoMeta(
  notification: AppBskyNotificationDefs.Notification,
  subjectOverride?: string,
): Pick<FlipNotification, 'video_id' | 'video_pid' | 'video_thumbnail'> {
  const subject = subjectOverride ?? getNotificationSubjectUri(notification)
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

  const subjectRepoDid = parseRepoDidFromAtUri(subject)
  let video_pid = subjectRepoDid

  // Reply/quote subjects live in the actor's repo; the media post belongs to the recipient.
  if (REPLY_NOTIFICATION_REASONS.has(notification.reason)) {
    const recipientDid = getAgent().session?.did
    if (recipientDid) {
      video_pid = recipientDid
    }
  } else if (!subject.includes('app.bsky.feed.post')) {
    video_pid = undefined
  }

  return {
    video_id: subject,
    video_pid,
    video_thumbnail: videoThumbnail,
  }
}

async function resolveNotificationSubject(
  notification: AppBskyNotificationDefs.Notification,
): Promise<string | undefined> {
  const subject = getNotificationSubjectUri(notification)
  if (!subject) return undefined
  if (subject.includes('app.bsky.feed.post')) return subject

  try {
    return await normalizeToPostUri(getAgent(), subject)
  } catch {
    return subject
  }
}

async function mapNotification(
  notification: AppBskyNotificationDefs.Notification,
): Promise<FlipNotification> {
  const subjectUri = await resolveNotificationSubject(notification)
  const videoMeta = extractVideoMeta(notification, subjectUri)

  return {
    id: notification.uri,
    type: reasonToType(notification.reason, subjectUri),
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
  const res = await withAuthenticatedFetch(() =>
    getAgent().listNotifications({ limit, cursor }),
  )
  const mapped = await Promise.all(res.data.notifications.map(mapNotification))
  return {
    notifications: mapped,
    cursor: res.data.cursor,
  }
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  if (!getAgent().session) return 0

  try {
    const res = await withAuthenticatedFetch(() => getAgent().countUnreadNotifications())
    return res.data.count ?? 0
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error
    return 0
  }
}

const LIKE_NOTIFICATION_TYPES = new Set(['video.like', 'comment.like', 'commentReply.like'])

async function countUnreadLikesAndFollows(): Promise<{ unreadLikes: number; unreadFollows: number }> {
  const { notifications } = await listNotificationsPage(undefined, 50)
  const unread = notifications.filter((n) => !n.read_at)
  return {
    unreadLikes: unread.filter((n) => LIKE_NOTIFICATION_TYPES.has(n.type)).length,
    unreadFollows: unread.filter((n) => n.type === 'new_follower').length,
  }
}

export async function fetchUnreadLikeCount(): Promise<number> {
  if (!getAgent().session) return 0

  try {
    const { unreadLikes } = await countUnreadLikesAndFollows()
    return unreadLikes
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error
    return 0
  }
}

export async function fetchUnreadFollowCount(): Promise<number> {
  if (!getAgent().session) return 0

  try {
    const { unreadFollows } = await countUnreadLikesAndFollows()
    return unreadFollows
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error
    return 0
  }
}

export type InboxUnreadBreakdown = {
  badgeCount: number
  unreadLikes: number
  unreadFollows: number
  unreadMessages: number
}

export async function fetchInboxUnreadBreakdown(
  unreadMessages: number,
): Promise<InboxUnreadBreakdown> {
  const [badgeCount, { unreadLikes, unreadFollows }] = await Promise.all([
    fetchUnreadNotificationCount(),
    countUnreadLikesAndFollows(),
  ])

  return { badgeCount, unreadLikes, unreadFollows, unreadMessages }
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
  const res = await withAuthenticatedFetch(() => getAgent().listNotifications({ limit: 50 }))
  const target = res.data.notifications.find((n) => n.uri === id)
  const seenAt = target?.indexedAt ?? new Date().toISOString()

  await withAuthenticatedFetch(() => getAgent().updateSeenNotifications({ seenAt }))
  return { data: {} }
}

export async function notificationTypeMarkAllAsRead(_type: string): Promise<{ data: Record<string, never> }> {
  await withAuthenticatedFetch(() =>
    getAgent().updateSeenNotifications({ seenAt: new Date().toISOString() }),
  )
  return { data: {} }
}
