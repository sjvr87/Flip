import Constants from 'expo-constants'
import { postsToFeedPage } from './adapters'
import { getAgent } from './agent'
import type { FlipFeedPage } from './types'

type PageParam = string | false | null | undefined

function normalizeCursor(pageParam: PageParam): string | undefined {
  if (!pageParam || pageParam === false) return undefined
  return String(pageParam)
}

/** Optional custom For You feed generator AT-URI (set in app.json extra.flipForYouFeed). */
function getForYouFeedUri(): string | undefined {
  return (
    Constants.expoConfig?.extra?.flipForYouFeed ||
    process.env.EXPO_PUBLIC_FLIP_FORYOU_FEED ||
    undefined
  )
}

export async function fetchFollowingFeed({
  pageParam = false,
}: { pageParam?: PageParam } = {}): Promise<FlipFeedPage> {
  const agent = getAgent()
  const res = await agent.getTimeline({
    limit: 30,
    cursor: normalizeCursor(pageParam),
  })

  return postsToFeedPage(res.data.feed, res.data.cursor)
}

export async function fetchForYouFeed({
  pageParam = false,
}: { pageParam?: PageParam } = {}): Promise<FlipFeedPage> {
  const agent = getAgent()
  const feedUri = getForYouFeedUri()

  if (feedUri) {
    const res = await agent.app.bsky.feed.getFeed({
      feed: feedUri,
      limit: 30,
      cursor: normalizeCursor(pageParam),
    })
    return postsToFeedPage(res.data.feed, res.data.cursor)
  }

  // Fallback: global search for recent posts, client-filtered to video embeds
  const res = await agent.app.bsky.feed.searchPosts({
    q: ' ',
    sort: 'latest',
    limit: 50,
    cursor: normalizeCursor(pageParam),
  })

  const feedItems = res.data.posts.map((post) => ({ post, reply: undefined }))
  return postsToFeedPage(feedItems, res.data.cursor)
}

/** Discover tab — same as For You fallback when no custom feed is configured. */
export async function fetchLocalFeed({
  pageParam = false,
}: { pageParam?: PageParam } = {}): Promise<FlipFeedPage> {
  return fetchForYouFeed({ pageParam })
}

export async function fetchSelfAccountVideos({
  queryKey,
  pageParam = false,
}: {
  queryKey?: unknown[]
  pageParam?: PageParam
} = {}): Promise<FlipFeedPage> {
  const agent = getAgent()
  const actor = agent.session?.did
  if (!actor) throw new Error('Not authenticated')

  const res = await agent.app.bsky.feed.getAuthorFeed({
    actor,
    filter: 'posts_with_video',
    limit: 30,
    cursor: normalizeCursor(pageParam),
  })

  return postsToFeedPage(
    res.data.feed.map((item) => ({ ...item, post: { ...item.post, author: item.post.author } })),
    res.data.cursor,
  )
}

export async function fetchUserVideos({
  queryKey,
  pageParam = false,
}: {
  queryKey: unknown[]
  pageParam?: PageParam
}): Promise<FlipFeedPage> {
  const actor = queryKey[1] as string
  const agent = getAgent()

  const res = await agent.app.bsky.feed.getAuthorFeed({
    actor,
    filter: 'posts_with_video',
    limit: 30,
    cursor: normalizeCursor(pageParam),
  })

  return postsToFeedPage(res.data.feed, res.data.cursor)
}

export async function recordImpression(
  _videoId: string,
  _duration: number,
  _completed?: boolean,
): Promise<void> {
  // ATProto has no Loops-style impression API; no-op for now
}
