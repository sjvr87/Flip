import type { AppBskyFeedDefs } from '@atproto/api'

import { isVideoPost, postToFlipVideo, profileToFlipUser } from './adapters'
import { getAgent } from './agent'
import { extractTagsFromRecord } from './mentions'
import type { FlipFeedPage } from './types'

const WHATS_HOT =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot'

const FALLBACK_TAGS = ['flip', 'video', 'music', 'comedy', 'art', 'gaming', 'sports']

export type ExploreTag = {
  id: number
  name: string
  count: number
}

export type ExploreAccount = {
  id: string
  name: string
  avatar: string
  username: string
  bio: string
  follower_count: number
  post_count?: number
}

function hashTagId(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function postsToVideoFeedPage(
  posts: AppBskyFeedDefs.PostView[],
  cursor?: string,
): FlipFeedPage {
  const feedItems = posts.map((post) => ({ post, reply: undefined }))
  const data = feedItems
    .map((item) => postToFlipVideo(item))
    .filter((v): v is NonNullable<ReturnType<typeof postToFlipVideo>> => v !== null)

  return {
    data,
    meta: {
      path: 'atproto',
      per_page: data.length,
      next_cursor: cursor && cursor.length > 0 ? cursor : null,
    },
  }
}

function topicToTagName(topic: { topic?: string; displayName?: string }): string | null {
  const raw = (topic.displayName || topic.topic || '').replace(/^#/, '').trim().toLowerCase()
  return raw.length > 0 ? raw : null
}

export async function getExploreTags(): Promise<ExploreTag[]> {
  const agent = getAgent()
  const seen = new Set<string>()
  const tags: ExploreTag[] = []

  try {
    const res = await agent.app.bsky.unspecced.getTrendingTopics({ limit: 15 })
    for (const topic of [...(res.data.topics ?? []), ...(res.data.suggested ?? [])]) {
      const name = topicToTagName(topic)
      if (!name || seen.has(name)) continue
      seen.add(name)
      tags.push({ id: hashTagId(name), name, count: 0 })
      if (tags.length >= 12) break
    }
  } catch (error) {
    console.warn('[explore] getTrendingTopics failed:', error)
  }

  if (tags.length > 0) return tags

  const tagCounts = new Map<string, number>()

  try {
    const res = await agent.app.bsky.feed.getFeed({ feed: WHATS_HOT, limit: 50 })
    for (const item of res.data.feed) {
      if (!isVideoPost(item.post)) continue
      const record = item.post.record as { text?: string; facets?: unknown }
      for (const tag of extractTagsFromRecord(record)) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }
  } catch (error) {
    console.warn('[explore] failed to derive tags from discover feed:', error)
  }

  if (tagCounts.size > 0) {
    return [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ id: hashTagId(name), name, count }))
  }

  return FALLBACK_TAGS.map((name, index) => ({ id: index + 1, name, count: 0 }))
}

export async function getExploreAccounts(): Promise<ExploreAccount[]> {
  const agent = getAgent()
  const res = await agent.app.bsky.actor.getSuggestions({ limit: 20 })

  return res.data.actors.map((actor) => {
    const profile = profileToFlipUser({
      did: actor.did,
      handle: actor.handle,
      displayName: actor.displayName,
      avatar: actor.avatar,
      description: actor.description,
      postsCount: actor.postsCount,
      followersCount: actor.followersCount,
      followsCount: actor.followsCount,
    })

    return {
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar,
      username: profile.username,
      bio: profile.bio,
      follower_count: profile.follower_count,
      post_count: profile.post_count,
    }
  })
}

const MAX_EMPTY_PAGE_FETCHES = 5

export async function getExploreTagsFeed({
  queryKey,
  pageParam = false,
}: {
  queryKey?: unknown[]
  pageParam?: string | false
} = {}): Promise<FlipFeedPage> {
  const tag = String(queryKey?.[2] ?? '').replace(/^#/, '')
  if (!tag) {
    return { data: [], meta: { path: 'atproto', per_page: 0, next_cursor: null } }
  }

  const agent = getAgent()
  let cursor = pageParam && pageParam !== false ? String(pageParam) : undefined
  const videos: FlipFeedPage['data'] = []
  let nextCursor: string | null = null

  for (let attempt = 0; attempt < MAX_EMPTY_PAGE_FETCHES; attempt++) {
    const res = await agent.app.bsky.feed.searchPosts({
      q: tag,
      tag,
      sort: 'latest',
      limit: 50,
      cursor,
    })

    const page = postsToVideoFeedPage(res.data.posts.filter(isVideoPost), res.data.cursor)
    videos.push(...page.data)
    nextCursor = page.meta.next_cursor

    if (page.data.length > 0 || !nextCursor) {
      break
    }

    cursor = nextCursor ?? undefined
  }

  return {
    data: videos,
    meta: {
      path: 'atproto',
      per_page: videos.length,
      next_cursor: nextCursor,
    },
  }
}

export async function postExploreAccountHideSuggestion(_id: string): Promise<{ data: Record<string, never> }> {
  // ATProto has no Loops-style suggestion hide; no-op so UI keeps working.
  return { data: {} }
}
