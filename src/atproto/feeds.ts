import type { AppBskyFeedDefs } from '@atproto/api'
import Constants from 'expo-constants'
import { decodeRouteParam } from '@/utils/profileNavigation'
import { postsToFeedPage } from './adapters'
import { getAgent } from './agent'
import type { FlipFeedPage, FlipVideo } from './types'

type PageParam = string | false | null | undefined

const MAX_EMPTY_PAGE_FETCHES = 5

function feedLoadError(context: string, error: unknown): never {
  const detail =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'
  throw new Error(`Could not load ${context}: ${detail}`)
}

function normalizeCursor(pageParam: PageParam): string | undefined {
  if (!pageParam || pageParam === false) return undefined
  const cursor = String(pageParam).trim()
  return cursor.length > 0 ? cursor : undefined
}

/**
 * Timeline/custom feeds include non-video posts; client-side filtering can yield
 * empty pages while the ATProto cursor still has more data. Chain fetches until
 * we have videos or exhaust the cursor (bounded to avoid runaway loops).
 */
async function fetchUntilVideoPage(
  fetchPage: (cursor: string | undefined) => Promise<{
    feed: AppBskyFeedDefs.FeedViewPost[]
    cursor?: string
  }>,
  pageParam: PageParam,
): Promise<FlipFeedPage> {
  let cursor = normalizeCursor(pageParam)
  const videos: FlipVideo[] = []
  let nextCursor: string | null = null

  for (let attempt = 0; attempt < MAX_EMPTY_PAGE_FETCHES; attempt++) {
    const res = await fetchPage(cursor)
    const page = postsToFeedPage(res.feed, res.cursor)
    videos.push(...page.data)
    nextCursor = page.meta.next_cursor

    if (page.data.length > 0 || !nextCursor) {
      break
    }

    cursor = nextCursor
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

/** Bluesky "What's Hot" — reliable discover feed when no custom generator is configured. */
const BLUESKY_WHATS_HOT =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot'

function normalizeFeedUri(uri: string | undefined | null): string | undefined {
  if (!uri) return undefined
  const trimmed = String(uri).trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Optional custom For You feed generator AT-URI (set in app.json extra.flipForYouFeed). */
function getForYouFeedUri(): string | undefined {
  return normalizeFeedUri(
    Constants.expoConfig?.extra?.flipForYouFeed ||
      process.env.EXPO_PUBLIC_FLIP_FORYOU_FEED,
  )
}

/** Optional custom Local feed generator AT-URI (set in app.json extra.flipLocalFeed). */
function getLocalFeedUri(): string | undefined {
  return normalizeFeedUri(
    Constants.expoConfig?.extra?.flipLocalFeed ||
      process.env.EXPO_PUBLIC_FLIP_LOCAL_FEED,
  )
}

async function fetchGeneratorFeed(
  feedUri: string,
  pageParam: PageParam,
  context = 'feed',
): Promise<FlipFeedPage> {
  try {
    const agent = getAgent()
    return await fetchUntilVideoPage(async (cursor) => {
      const res = await agent.app.bsky.feed.getFeed({
        feed: feedUri,
        limit: 30,
        cursor,
      })
      return { feed: res.data.feed, cursor: res.data.cursor }
    }, pageParam)
  } catch (error) {
    feedLoadError(context, error)
  }
}

export async function fetchFollowingFeed({
  pageParam = false,
}: { pageParam?: PageParam } = {}): Promise<FlipFeedPage> {
  try {
    const agent = getAgent()
    return await fetchUntilVideoPage(async (cursor) => {
      const res = await agent.getTimeline({
        limit: 30,
        cursor,
      })
      return { feed: res.data.feed, cursor: res.data.cursor }
    }, pageParam)
  } catch (error) {
    feedLoadError('following feed', error)
  }
}

export async function fetchForYouFeed({
  pageParam = false,
}: { pageParam?: PageParam } = {}): Promise<FlipFeedPage> {
  const feedUri = getForYouFeedUri() ?? BLUESKY_WHATS_HOT
  return fetchGeneratorFeed(feedUri, pageParam, 'for you feed')
}

/**
 * Local tab — optional custom feed generator, else recent video posts from the network.
 * Location-based feeds require a geo feed generator URI in flipLocalFeed; without it we
 * search for recent videos and surface a clear message when nothing is found.
 */
export async function fetchLocalFeed({
  pageParam = false,
}: { pageParam?: PageParam } = {}): Promise<FlipFeedPage> {
  const customUri = getLocalFeedUri()
  if (customUri) {
    return fetchGeneratorFeed(customUri, pageParam, 'local feed')
  }

  const agent = getAgent()
  let page: FlipFeedPage

  try {
    page = await fetchUntilVideoPage(async (cursor) => {
      const res = await agent.app.bsky.feed.searchPosts({
        q: 'video',
        sort: 'latest',
        limit: 50,
        cursor,
      })
      const feed = res.data.posts.map((post) => ({ post, reply: undefined }))
      return { feed, cursor: res.data.cursor }
    }, pageParam)
  } catch (error) {
    console.warn('[feed] local searchPosts failed, falling back to discover:', error)
    page = await fetchGeneratorFeed(BLUESKY_WHATS_HOT, pageParam, 'discover feed')
    return {
      ...page,
      meta: {
        ...page.meta,
        error:
          'Location is unavailable. Showing popular posts — configure flipLocalFeed for a geo feed.',
      },
    }
  }

  if (page.data.length === 0 && !page.meta.next_cursor && !normalizeCursor(pageParam)) {
    return {
      ...page,
      meta: {
        ...page.meta,
        error:
          'No local videos found yet. Nearby feeds need a geo feed generator (flipLocalFeed) or try again later.',
      },
    }
  }

  return page
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

export async function fetchUserVideoCursor({
  queryKey,
  pageParam = false,
}: {
  queryKey: unknown[]
  pageParam?: PageParam
}): Promise<FlipFeedPage> {
  const actor = String(queryKey[1] ?? '')
  const videoUri = decodeRouteParam(queryKey[2] as string)
  const agent = getAgent()

  if (!pageParam) {
    const [postRes, feedRes] = await Promise.all([
      agent.getPosts({ uris: [videoUri] }),
      agent.app.bsky.feed.getAuthorFeed({
        actor,
        filter: 'posts_with_video',
        limit: 30,
      }),
    ])

    const targetPost = postRes.data.posts[0]
    const feedItems = feedRes.data.feed
    const hasTarget = feedItems.some((item) => item.post.uri === videoUri)

    const items =
      targetPost && !hasTarget
        ? [{ post: targetPost, reply: undefined }, ...feedItems]
        : feedItems

    return postsToFeedPage(items, feedRes.data.cursor)
  }

  return fetchUserVideos({ queryKey: ['userVideos', actor], pageParam })
}

export async function fetchAccountLikes({
  pageParam = false,
}: { pageParam?: PageParam } = {}): Promise<FlipFeedPage> {
  const agent = getAgent()
  const actor = agent.session?.did
  if (!actor) throw new Error('Not authenticated')

  const res = await agent.app.bsky.feed.getActorLikes({
    actor,
    limit: 30,
    cursor: normalizeCursor(pageParam),
  })

  return postsToFeedPage(res.data.feed, res.data.cursor)
}

export async function fetchAccountFavorites({
  pageParam = false,
}: { pageParam?: PageParam } = {}): Promise<FlipFeedPage> {
  const agent = getAgent()
  if (!agent.session) throw new Error('Not authenticated')

  try {
    const res = await agent.app.bsky.bookmark.getBookmarks({
      limit: 30,
      cursor: normalizeCursor(pageParam),
    })

    const feed = (res.data.bookmarks ?? [])
      .map((bookmark) => {
        const post = (bookmark as { post?: AppBskyFeedDefs.PostView }).post
        return post ? { post, reply: undefined } : null
      })
      .filter((item): item is AppBskyFeedDefs.FeedViewPost => item !== null)

    return postsToFeedPage(feed, res.data.cursor)
  } catch (error) {
    console.warn('[feed] bookmarks unavailable on this PDS:', error)
    return {
      data: [],
      meta: { path: 'atproto', per_page: 0, next_cursor: null },
    }
  }
}

export async function recordImpression(
  _videoId: string,
  _duration: number,
  _completed?: boolean,
): Promise<void> {
  // ATProto has no Loops-style impression API; no-op for now
}
