import type { AppBskyNotificationDefs } from '@atproto/api'
import { AppBskyEmbedVideo, AppBskyFeedLike, AppBskyFeedRepost } from '@atproto/api'

import { getAgent, SessionExpiredError, withAuthenticatedFetch } from './agent'
import { normalizeToPostUri, resolveMediaPostView } from './postResolve'
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
    // Duck-type: listNotifications records may omit a decoded $type.
    if (record && typeof record === 'object' && 'subject' in record) {
      const subjectUri = (record as { subject?: { uri?: string } }).subject?.uri
      if (typeof subjectUri === 'string' && subjectUri.length > 0) {
        return subjectUri
      }
    }
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

const MEDIA_NAV_REASONS = new Set([
  'like',
  'like-via-repost',
  'reply',
  'quote',
  'mention',
  'repost',
  'repost-via-repost',
])

async function resolveMediaVideoMeta(
  notification: AppBskyNotificationDefs.Notification,
  subjectUri: string,
): Promise<Pick<FlipNotification, 'video_id' | 'video_pid' | 'video_thumbnail'>> {
  const fallback = extractVideoMeta(notification, subjectUri)

  if (!MEDIA_NAV_REASONS.has(notification.reason)) {
    return fallback
  }

  try {
    const mediaPost = await resolveMediaPostView(getAgent(), subjectUri)
    if (mediaPost) {
      if (__DEV__) {
        console.log('[notifications] resolved media post', {
          reason: notification.reason,
          subjectUri,
          mediaUri: mediaPost.uri,
          authorDid: mediaPost.author.did,
        })
      }
      return {
        video_id: mediaPost.uri,
        video_pid: mediaPost.author.did,
        video_thumbnail: fallback.video_thumbnail,
      }
    }
    if (__DEV__) {
      console.warn('[notifications] no media post for subject', {
        reason: notification.reason,
        subjectUri,
      })
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[notifications] media resolve failed', {
        reason: notification.reason,
        subjectUri,
        error,
      })
    }
  }

  return fallback
}

async function mapNotification(
  notification: AppBskyNotificationDefs.Notification,
): Promise<FlipNotification> {
  const subjectUri = await resolveNotificationSubject(notification)
  const videoMeta = subjectUri
    ? await resolveMediaVideoMeta(notification, subjectUri)
    : extractVideoMeta(notification)

  return {
    id: notification.uri,
    type: reasonToType(notification.reason, subjectUri),
    ...videoMeta,
    actor: actorFromNotification(notification.author),
    read_at: notification.isRead ? notification.indexedAt : null,
    created_at: notification.indexedAt,
  }
}

const LIKES_FAVORITES_TYPES = new Set([
  'video.like',
  'comment.like',
  'commentReply.like',
  'video.share',
])

const COMMENT_ACTIVITY_TYPES_FILTER = new Set([
  'video.comment',
  'video.commentReply',
  'comment.share',
  'commentReply.share',
])

function matchesActivityFilter(
  notification: FlipNotification,
  filter: string,
): boolean {
  switch (filter) {
    case 'followers':
      return notification.type === 'new_follower'
    case 'mentions':
      return notification.type === 'video.mention'
    case 'likesFavorites':
      return LIKES_FAVORITES_TYPES.has(notification.type)
    case 'comments':
      return COMMENT_ACTIVITY_TYPES_FILTER.has(notification.type)
    case 'videoLike':
      return notification.type === 'video.like'
    case 'videoShare':
      return notification.type === 'video.share'
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

async function countUnreadLikesAndFollows(): Promise<{
  unreadLikes: number
  unreadFollows: number
  unreadActivity: number
}> {
  const { notifications } = await listNotificationsPage(undefined, 50)
  const unread = notifications.filter((n) => !n.read_at)
  return {
    unreadLikes: unread.filter((n) => LIKE_NOTIFICATION_TYPES.has(n.type)).length,
    unreadFollows: unread.filter((n) => n.type === 'new_follower').length,
    unreadActivity: unread.filter((n) => n.type !== 'new_follower').length,
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
  unreadActivity: number
  unreadMessages: number
}

export async function fetchInboxUnreadBreakdown(
  unreadMessages: number,
): Promise<InboxUnreadBreakdown> {
  const [badgeCount, { unreadLikes, unreadFollows, unreadActivity }] = await Promise.all([
    fetchUnreadNotificationCount(),
    countUnreadLikesAndFollows(),
  ])

  return { badgeCount, unreadLikes, unreadFollows, unreadActivity, unreadMessages }
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

function resolveSeenAtIso(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value
  if (value && typeof value === 'object' && 'seenAt' in value) {
    const nested = (value as { seenAt?: unknown }).seenAt
    if (typeof nested === 'string' && nested.length > 0) return nested
  }
  return new Date().toISOString()
}

async function markNotificationsSeen(seenAtInput: unknown): Promise<void> {
  const seenAt = resolveSeenAtIso(seenAtInput)
  await withAuthenticatedFetch(() =>
    getAgent().app.bsky.notification.updateSeen({ seenAt }),
  )
}

export async function notificationMarkAsRead(id: string): Promise<{ data: Record<string, never> }> {
  const res = await withAuthenticatedFetch(() => getAgent().listNotifications({ limit: 50 }))
  const target = res.data.notifications.find((n) => n.uri === id)
  const seenAt = target?.indexedAt ?? new Date().toISOString()

  await markNotificationsSeen(seenAt)
  return { data: {} }
}

export async function notificationTypeMarkAllAsRead(_type: string): Promise<{ data: Record<string, never> }> {
  await markNotificationsSeen(new Date().toISOString())
  return { data: {} }
}

const COMMENT_ACTIVITY_TYPES = new Set([
  'video.comment',
  'video.commentReply',
  'comment.like',
  'comment.share',
  'commentReply.like',
  'commentReply.share',
])

async function findRawNotification(
  notificationUri: string,
): Promise<AppBskyNotificationDefs.Notification | undefined> {
  let cursor: string | undefined

  for (let page = 0; page < 5; page++) {
    const res = await withAuthenticatedFetch(() =>
      getAgent().listNotifications({ limit: 50, cursor }),
    )
    const found = res.data.notifications.find((n) => n.uri === notificationUri)
    if (found) return found
    cursor = res.data.cursor
    if (!cursor) break
  }

  return undefined
}

export type NotificationTapTarget = {
  postUri: string
  openComments: boolean
}

/** Re-fetch and resolve the playable post URI at tap time (not just list-map time). */
export async function resolveNotificationTapTarget(
  item: Pick<FlipNotification, 'id' | 'type' | 'video_id' | 'video_pid'>,
): Promise<NotificationTapTarget | null> {
  const openComments = COMMENT_ACTIVITY_TYPES.has(item.type)

  if (item.id) {
    try {
      const raw = await findRawNotification(item.id)
      if (raw) {
        const mapped = await mapNotification(raw)
        if (mapped.video_id) {
          if (__DEV__) {
            console.log('[notifications] tap target from fresh fetch', {
              type: item.type,
              notificationId: item.id,
              cachedVideoId: item.video_id,
              resolvedVideoId: mapped.video_id,
            })
          }
          return { postUri: mapped.video_id, openComments }
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[notifications] tap re-fetch failed', { id: item.id, error })
      }
    }
  }

  if (item.video_id) {
    try {
      const agent = getAgent()
      const mediaPost = await resolveMediaPostView(agent, item.video_id)
      if (mediaPost?.uri) {
        if (__DEV__) {
          console.log('[notifications] tap target from media resolve', {
            type: item.type,
            input: item.video_id,
            resolved: mediaPost.uri,
          })
        }
        return { postUri: mediaPost.uri, openComments }
      }

      const normalized = await normalizeToPostUri(agent, item.video_id)
      if (normalized.includes('app.bsky.feed.post')) {
        return { postUri: normalized, openComments }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[notifications] tap media resolve failed', {
          video_id: item.video_id,
          error,
        })
      }
    }

    return { postUri: item.video_id, openComments }
  }

  return null
}
