import { AppBskyEmbedVideo, type AppBskyFeedDefs } from '@atproto/api'
import type { FlipAccount, FlipUserProfile, FlipVideo } from './types'
import { getAgent } from './agent'

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

export function isVideoPost(post: AppBskyFeedDefs.PostView): boolean {
  return getVideoEmbed(post) !== null
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

export function postToFlipVideo(
  feedItem: AppBskyFeedDefs.FeedViewPost,
  options?: { forceOwner?: boolean },
): FlipVideo | null {
  const post = feedItem.post
  const video = getVideoEmbed(post)
  if (!video?.playlist) return null

  const agent = getAgent()
  const isOwner = options?.forceOwner ?? post.author.did === agent.session?.did

  return {
    id: post.uri,
    cid: post.cid,
    account: toAccount(post.author),
    caption: (post.record as { text?: string }).text || '',
    url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
    is_owner: isOwner,
    is_sensitive: false,
    media: {
      width: video.aspectRatio?.width ?? 9,
      height: video.aspectRatio?.height ?? 16,
      thumbnail: video.thumbnail || '',
      src_url: video.playlist,
      duration: 0,
    },
    likes: post.likeCount ?? 0,
    shares: post.repostCount ?? 0,
    comments: post.replyCount ?? 0,
    has_liked: !!post.viewer?.like,
    has_bookmarked: !!post.viewer?.bookmarked,
    created_at: (post.record as { createdAt?: string }).createdAt || new Date().toISOString(),
  }
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
      next_cursor: cursor ?? null,
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
