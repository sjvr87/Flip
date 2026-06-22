import {
  AppBskyEmbedImages,
  AppBskyEmbedVideo,
  RichText,
  type AppBskyFeedDefs,
} from '@atproto/api'
import type {
  FlipAccount,
  FlipAudioSource,
  FlipPermissions,
  FlipTextPost,
  FlipUserProfile,
  FlipVideo,
  FlipVideoMeta,
} from './types'
import { getAgent } from './agent'
import { hasAdultLabels, isSensitivePost, shouldHideAdultContent } from './contentLabels'
import { extractMentionsFromRecord, extractTagsFromRecord } from './mentions'

type ImageEmbedView = AppBskyEmbedImages.View

/** Gallery embed is not yet in @atproto/api — parse view payloads by $type. */
type GalleryViewImage = {
  $type?: string
  thumbnail?: string
  fullsize?: string
  alt?: string
  aspectRatio?: { width: number; height: number }
}

type GalleryView = {
  $type?: string
  items?: GalleryViewImage[]
}

function isGalleryView(embed: unknown): embed is GalleryView {
  return (
    typeof embed === 'object' &&
    embed !== null &&
    (embed as GalleryView).$type === 'app.bsky.embed.gallery#view'
  )
}

function isGalleryViewImage(item: unknown): item is GalleryViewImage {
  return (
    typeof item === 'object' &&
    item !== null &&
    ((item as GalleryViewImage).$type === 'app.bsky.embed.gallery#viewImage' ||
      !!(item as GalleryViewImage).thumbnail ||
      !!(item as GalleryViewImage).fullsize)
  )
}

function getVideoEmbed(post: AppBskyFeedDefs.PostView): AppBskyEmbedVideo.View | null {
  const embed = post.embed
  if (!embed) return null

  if (AppBskyEmbedVideo.isView(embed)) {
    return embed
  }

  if (
    embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
    'media' in embed &&
    embed.media &&
    AppBskyEmbedVideo.isView(embed.media)
  ) {
    return embed.media
  }

  return null
}

function galleryViewToImages(embed: GalleryView): ImageEmbedView | null {
  const first = embed.items?.find(
    (item): item is GalleryViewImage =>
      isGalleryViewImage(item) &&
      !!(item.thumbnail || item.fullsize || (item as { thumb?: string }).thumb),
  )
  if (!first) return null

  const thumb = first.thumbnail || (first as { thumb?: string }).thumb

  return {
    $type: 'app.bsky.embed.images#view',
    images: [
      {
        $type: 'app.bsky.embed.images#viewImage',
        thumb,
        fullsize: first.fullsize,
        alt: first.alt,
        aspectRatio: first.aspectRatio,
      },
    ],
  }
}

type RecordBlobRef = {
  ref?: { $link?: string } | string
  mimeType?: string
}

type RecordImageEntry = {
  alt?: string
  image?: RecordBlobRef
  aspectRatio?: { width: number; height: number }
}

type RecordImageEmbed = {
  $type?: string
  images?: RecordImageEntry[]
  items?: RecordImageEntry[]
}

function blobRefToCid(blob?: RecordBlobRef): string | null {
  if (!blob?.ref) return null
  if (typeof blob.ref === 'string') return blob.ref
  return blob.ref.$link ?? null
}

function mimeToCdnExtension(mimeType?: string): string {
  if (!mimeType) return 'jpeg'
  const subtype = mimeType.split('/')[1]?.toLowerCase() ?? 'jpeg'
  if (subtype === 'jpg') return 'jpeg'
  return subtype.replace(/[^a-z0-9]/g, '') || 'jpeg'
}

function cdnImageUrls(
  did: string,
  cid: string,
  mimeType?: string,
): { thumb: string; fullsize: string } {
  const ext = mimeToCdnExtension(mimeType)
  const base = `https://cdn.bsky.app/img`
  return {
    thumb: `${base}/feed_thumbnail/plain/${did}/${cid}@${ext}`,
    fullsize: `${base}/feed_fullsize/plain/${did}/${cid}@${ext}`,
  }
}

function getImageEmbedFromRecord(
  post: AppBskyFeedDefs.PostView,
): ImageEmbedView | null {
  const record = post.record as { embed?: RecordImageEmbed }
  const recordEmbed = record?.embed
  if (!recordEmbed?.$type) return null

  let first: RecordImageEntry | undefined
  if (recordEmbed.$type === 'app.bsky.embed.images') {
    first = recordEmbed.images?.[0]
  } else if (recordEmbed.$type === 'app.bsky.embed.gallery') {
    first = recordEmbed.items?.[0]
  }

  const cid = blobRefToCid(first?.image)
  if (!cid) return null

  const urls = cdnImageUrls(post.author.did, cid, first?.image?.mimeType)

  return {
    $type: 'app.bsky.embed.images#view',
    images: [
      {
        $type: 'app.bsky.embed.images#viewImage',
        thumb: urls.thumb,
        fullsize: urls.fullsize,
        alt: first?.alt,
        aspectRatio: first?.aspectRatio,
      },
    ],
  }
}

function getImageEmbedFromView(post: AppBskyFeedDefs.PostView): ImageEmbedView | null {
  const embed = post.embed
  if (!embed) return null

  if (AppBskyEmbedImages.isView(embed)) {
    return embed
  }

  if (isGalleryView(embed)) {
    return galleryViewToImages(embed)
  }

  if (
    embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
    'media' in embed &&
    embed.media
  ) {
    if (AppBskyEmbedImages.isView(embed.media)) {
      return embed.media
    }
    if (isGalleryView(embed.media)) {
      return galleryViewToImages(embed.media)
    }
  }

  return null
}

function viewImageHasUrl(images: ImageEmbedView | null): boolean {
  const first = images?.images?.[0]
  return !!(first?.fullsize || first?.thumb)
}

function getImageEmbed(post: AppBskyFeedDefs.PostView): ImageEmbedView | null {
  const fromView = getImageEmbedFromView(post)
  if (viewImageHasUrl(fromView)) {
    return fromView
  }

  const fromRecord = getImageEmbedFromRecord(post)
  if (fromRecord) {
    return fromRecord
  }

  return fromView
}

export function isVideoPost(post: AppBskyFeedDefs.PostView): boolean {
  return getVideoEmbed(post) !== null
}

export function isPhotoPost(post: AppBskyFeedDefs.PostView): boolean {
  return getImageEmbed(post) !== null
}

export function isMediaPost(post: AppBskyFeedDefs.PostView): boolean {
  return isVideoPost(post) || isPhotoPost(post)
}

export function isTextOnlyPost(post: AppBskyFeedDefs.PostView): boolean {
  const record = post.record as { text?: string }
  const text = (record?.text || '').trim()
  if (text.length === 0) return false
  if (isVideoPost(post) || isPhotoPost(post)) return false

  const embed = post.embed
  if (!embed) return true

  if (
    embed.$type === 'app.bsky.embed.recordWithMedia#view' ||
    embed.$type === 'app.bsky.embed.images#view' ||
    embed.$type === 'app.bsky.embed.video#view'
  ) {
    return false
  }

  if (isGalleryView(embed)) return false

  return true
}

export function postToFlipTextPost(
  feedItem: AppBskyFeedDefs.FeedViewPost,
): FlipTextPost | null {
  const post = feedItem.post

  if (!isTextOnlyPost(post)) return null
  if (shouldHideAdultContent() && hasAdultLabels(post)) return null

  const record = post.record as { text?: string; facets?: RichText['facets']; createdAt?: string }
  const text = (record.text || '').trim()
  if (!text) return null

  const account = toAccount(post.author)

  return {
    id: post.uri,
    cid: post.cid,
    account,
    text,
    tags: extractTagsFromRecord(record),
    mentions: extractMentionsFromRecord(record),
    likes: post.likeCount ?? 0,
    comments: post.replyCount ?? 0,
    reposts: post.repostCount ?? 0,
    bookmarks: 0,
    has_liked: !!post.viewer?.like,
    has_bookmarked: !!post.viewer?.bookmarked,
    has_reposted: !!post.viewer?.repost,
    created_at: record.createdAt || new Date().toISOString(),
  }
}

type FlipRecordExtension = {
  flip?: {
    permissions?: Partial<FlipPermissions>
    audioSource?: Partial<FlipAudioSource>
    meta?: FlipVideoMeta
  }
}

function extractFlipExtensions(
  post: AppBskyFeedDefs.PostView,
  author: FlipAccount,
): {
  permissions: FlipPermissions
  audioSource: FlipAudioSource
  meta?: FlipVideoMeta
} {
  const record = post.record as FlipRecordExtension
  const flip = record.flip

  const audioSource: FlipAudioSource = flip?.audioSource?.username
    ? {
        username: flip.audioSource.username,
        profileId: flip.audioSource.profileId,
        postUri: flip.audioSource.postUri,
        isOriginal:
          flip.audioSource.isOriginal ??
          (!flip.audioSource.postUri || flip.audioSource.postUri === post.uri),
      }
    : {
        username: author.username,
        profileId: author.id,
        postUri: post.uri,
        isOriginal: true,
      }

  const permissions: FlipPermissions = {
    can_comment: flip?.permissions?.can_comment ?? true,
    can_download: flip?.permissions?.can_download ?? false,
    can_duet: flip?.permissions?.can_duet ?? false,
    can_stitch: flip?.permissions?.can_stitch ?? false,
    can_use_audio: flip?.permissions?.can_use_audio ?? true,
  }

  return {
    permissions,
    audioSource,
    meta: flip?.meta,
  }
}

function toAccount(author: AppBskyFeedDefs.PostView['author']): FlipAccount {
  const handle = author.handle || author.did
  const username = handle.includes('.') ? handle.split('.')[0] : handle

  return {
    id: author.did,
    name: author.displayName || handle,
    avatar: author.avatar || '',
    username,
    url: `https://bsky.app/profile/${handle}`,
  }
}

function baseFlipItem(
  feedItem: AppBskyFeedDefs.FeedViewPost,
  options?: { forceOwner?: boolean },
): Omit<FlipVideo, 'media' | 'is_photo' | 'media_type'> {
  const post = feedItem.post
  const agent = getAgent()
  const isOwner = options?.forceOwner ?? post.author.did === agent.session?.did
  const record = post.record as { text?: string; facets?: RichText['facets'] }
  const account = toAccount(post.author)
  const { permissions, audioSource, meta } = extractFlipExtensions(post, account)

  return {
    id: post.uri,
    cid: post.cid,
    account,
    caption: record.text || '',
    tags: extractTagsFromRecord(record),
    mentions: extractMentionsFromRecord(record),
    url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
    is_owner: isOwner,
    is_sensitive: isSensitivePost(post),
    likes: post.likeCount ?? 0,
    shares: post.repostCount ?? 0,
    comments: post.replyCount ?? 0,
    bookmarks: 0,
    has_liked: !!post.viewer?.like,
    has_bookmarked: !!post.viewer?.bookmarked,
    has_reposted: !!post.viewer?.repost,
    created_at: (post.record as { createdAt?: string }).createdAt || new Date().toISOString(),
    permissions,
    audioSource,
    meta,
  }
}

export function postToFlipItem(
  feedItem: AppBskyFeedDefs.FeedViewPost,
  options?: { forceOwner?: boolean },
): FlipVideo | null {
  const post = feedItem.post

  if (shouldHideAdultContent() && hasAdultLabels(post)) {
    return null
  }

  const video = getVideoEmbed(post)

  if (video) {
    return {
      ...baseFlipItem(feedItem, options),
      is_photo: false,
      media_type: 'video',
      media: {
        width: video.aspectRatio?.width ?? 9,
        height: video.aspectRatio?.height ?? 16,
        thumbnail: video.thumbnail || '',
        src_url: video.playlist || video.thumbnail || '',
        duration: 0,
      },
    }
  }

  const images = getImageEmbed(post)
  const firstImage = images?.images?.[0]
  if (!firstImage?.fullsize && !firstImage?.thumb) return null

  return {
    ...baseFlipItem(feedItem, options),
    is_photo: true,
    media_type: 'photo',
    media: {
      width: firstImage.aspectRatio?.width ?? 1,
      height: firstImage.aspectRatio?.height ?? 1,
      thumbnail: firstImage.thumb || firstImage.fullsize || '',
      src_url: firstImage.fullsize || firstImage.thumb || '',
      duration: 0,
    },
  }
}

export function postToFlipVideo(
  feedItem: AppBskyFeedDefs.FeedViewPost,
  options?: { forceOwner?: boolean },
): FlipVideo | null {
  const post = feedItem.post

  if (shouldHideAdultContent() && hasAdultLabels(post)) {
    return null
  }

  const video = getVideoEmbed(post)
  if (!video?.playlist) return null
  const item = postToFlipItem(feedItem, options)
  return item?.media_type === 'video' ? item : null
}

export function postsToFeedPage(
  items: AppBskyFeedDefs.FeedViewPost[],
  cursor?: string,
): { data: FlipVideo[]; meta: FlipVideo extends never ? never : import('./types').FlipFeedPage['meta'] } {
  const data = items
    .map((item) => postToFlipVideo(item))
    .filter((v): v is FlipVideo => v !== null)

  return {
    data,
    meta: {
      path: 'atproto',
      per_page: data.length,
      next_cursor: cursor && cursor.length > 0 ? cursor : null,
    },
  }
}

export type MediaPageFilter = 'all' | 'video' | 'photo'

function matchesMediaFilter(item: FlipVideo, filter: MediaPageFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'photo') return item.media_type === 'photo' || item.is_photo === true
  return item.media_type === 'video' || !item.is_photo
}

export function postsToMediaPage(
  items: AppBskyFeedDefs.FeedViewPost[],
  cursor?: string,
  filter: MediaPageFilter = 'all',
): { data: FlipVideo[]; meta: FlipVideo extends never ? never : import('./types').FlipFeedPage['meta'] } {
  const data = items
    .map((item) => postToFlipItem(item))
    .filter((v): v is FlipVideo => v !== null)
    .filter((item) => matchesMediaFilter(item, filter))

  return {
    data,
    meta: {
      path: 'atproto',
      per_page: data.length,
      next_cursor: cursor && cursor.length > 0 ? cursor : null,
    },
  }
}

export function profileToFlipUser(
  profile: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
    description?: string
    postsCount?: number
    followersCount?: number
    followsCount?: number
  },
  isOwner = false,
): FlipUserProfile {
  const username = profile.handle.includes('.')
    ? profile.handle.split('.')[0]
    : profile.handle

  return {
    id: profile.did,
    username,
    name: profile.displayName || profile.handle,
    acct: profile.handle,
    display_name: profile.displayName || profile.handle,
    avatar: profile.avatar || '',
    bio: profile.description || '',
    post_count: profile.postsCount ?? 0,
    follower_count: profile.followersCount ?? 0,
    following_count: profile.followsCount ?? 0,
    url: `https://bsky.app/profile/${profile.handle}`,
    is_owner: isOwner,
    has_playlists: false,
  }
}
