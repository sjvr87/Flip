import type { AppBskyFeedDefs } from '@atproto/api'

import {
  EXPLORE_ACCOUNTS_LIMIT,
  EXPLORE_DEFAULT_TAG,
  EXPLORE_FEED_PAGE_SIZE,
  EXPLORE_TAGS_LIMIT,
} from '@/utils/exploreCache'

import { isVideoPost, postToFlipVideo, profileToFlipUser } from './adapters'
import { getAgent, withAuthenticatedFetch } from './agent'
import type { FlipFeedPage } from './types'

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
  const seen = new Set<string>()
  const tags: ExploreTag[] = []

  try {
    const res = await withAuthenticatedFetch(() =>
      getAgent().app.bsky.unspecced.getTrendingTopics({ limit: EXPLORE_TAGS_LIMIT }),
    )
    for (const topic of [...(res.data.topics ?? []), ...(res.data.suggested ?? [])]) {
      const name = topicToTagName(topic)
      if (!name || seen.has(name)) continue
      seen.add(name)
      tags.push({ id: hashTagId(name), name, count: 0 })
      if (tags.length >= EXPLORE_TAGS_LIMIT) break
    }
  } catch (error) {
    console.warn('[explore] getTrendingTopics failed:', error)
  }

  if (tags.length > 0) return tags

  // Skip scanning whats-hot — that feed fetch blocked first paint on slow networks.
  return FALLBACK_TAGS.map((name, index) => ({ id: index + 1, name, count: 0 }))
}

export async function getExploreAccounts(): Promise<ExploreAccount[]> {
  const res = await withAuthenticatedFetch(() =>
    getAgent().app.bsky.actor.getSuggestions({ limit: EXPLORE_ACCOUNTS_LIMIT }),
  )

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

export async function getExploreTagsFeed({
  queryKey,
  pageParam = false,
}: {
  queryKey?: unknown[]
  pageParam?: string | false
} = {}): Promise<FlipFeedPage> {
  const tag = String(queryKey?.[2] ?? EXPLORE_DEFAULT_TAG).replace(/^#/, '')
  if (!tag) {
    return { data: [], meta: { path: 'atproto', per_page: 0, next_cursor: null } }
  }

  const cursor = pageParam && pageParam !== false ? String(pageParam) : undefined

  const res = await withAuthenticatedFetch(() =>
    getAgent().app.bsky.feed.searchPosts({
      q: tag,
      tag,
      sort: 'latest',
      limit: EXPLORE_FEED_PAGE_SIZE,
      cursor,
    }),
  )

  const page = postsToVideoFeedPage(res.data.posts.filter(isVideoPost), res.data.cursor)

  return {
    data: page.data,
    meta: {
      path: 'atproto',
      per_page: page.data.length,
      next_cursor: page.meta.next_cursor,
    },
  }
}

export async function postExploreAccountHideSuggestion(_id: string): Promise<{ data: Record<string, never> }> {
  // ATProto has no Loops-style suggestion hide; no-op so UI keeps working.
  return { data: {} }
}
