import { AppBskyEmbedImages, AppBskyEmbedVideo, RichText, type AppBskyFeedDefs } from '@atproto/api'
import type { FlipAccount, FlipUserProfile, FlipVideo } from './types'
import { getAgent } from './agent'
import { hasAdultLabels, isSensitivePost, shouldHideAdultContent } from './contentLabels'
import { extractMentionsFromRecord, extractTagsFromRecord } from './mentions'

type ImageEmbedView = AppBskyEmbedImages.View

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

function getImageEmbed(post: AppBskyFeedDefs.PostView): ImageEmbedView | null {
  const embed = post.embed
  if (!embed) return null

  if (AppBskyEmbedImages.isView(embed)) {
    return embed
  }

  if (
    embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
    'media' in embed &&
    embed.media &&
    AppBskyEmbedImages.isView(embed.media)
  ) {
    return embed.media
  }

  return null
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

  return {
    id: post.uri,
    cid: post.cid,
    account: toAccount(post.author),
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
    created_at: (post.record as { createdAt?: string }).createdAt || new Date().toISOString(),
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

export function postsToMediaPage(
  items: AppBskyFeedDefs.FeedViewPost[],
  cursor?: string,
): { data: FlipVideo[]; meta: FlipVideo extends never ? never : import('./types').FlipFeedPage['meta'] } {
  const data = items
    .map((item) => postToFlipItem(item))
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
