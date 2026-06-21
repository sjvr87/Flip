import type { AppBskyFeedDefs } from '@atproto/api'
import Constants from 'expo-constants'
import { decodeRouteParam } from '@/utils/profileNavigation'
import {
  DISCOVERY_SEARCH_LIMIT,
  FOLLOWING_MAX_CHAIN_FETCHES,
  shuffleFeedVideos,
  videoDedupeKey,
} from '@/utils/feedCache'
import { postsToFeedPage, postsToMediaPage } from './adapters'
import { getAgent, SessionExpiredError, withAuthenticatedFetch } from './agent'
import type { FlipFeedPage, FlipVideo } from './types'

type PageParam = string | false | null | undefined

const PAGE_SRC_PREFIX = 'flip-src:'

type ForYouSourceId = 'thevids' | 'search-latest' | 'search-top' | 'whats-hot' | 'custom'
type LocalSourceId = 'thevids' | 'search-latest' | 'search-top'

type FeedFetchOptions = {
  pageParam?: PageParam
  /** Bumped on pull-to-refresh / hard refresh — rotates sources and shuffles page order. */
  refreshEpoch?: number
}

function decodeFeedPageParam(pageParam: PageParam): { sourceId?: string; cursor?: string } {
  if (!pageParam || pageParam === false) {
    return {}
  }
  const raw = String(pageParam).trim()
  if (!raw.startsWith(PAGE_SRC_PREFIX)) {
    return { cursor: raw }
  }
  const body = raw.slice(PAGE_SRC_PREFIX.length)
  const pipe = body.indexOf('|')
  if (pipe === -1) {
    return { sourceId: body }
  }
  return {
    sourceId: body.slice(0, pipe),
    cursor: body.slice(pipe + 1) || undefined,
  }
}

function encodeFeedPageParam(sourceId: string, cursor?: string | null): string {
  return `${PAGE_SRC_PREFIX}${sourceId}|${cursor ?? ''}`
}

function isFirstFeedPage(pageParam: PageParam): boolean {
  const decoded = decodeFeedPageParam(pageParam)
  return !decoded.cursor && !decoded.sourceId
}

function finalizeFirstPage(page: FlipFeedPage, refreshEpoch: number): FlipFeedPage {
  if (page.data.length <= 1) {
    return page
  }
  return {
    ...page,
    data: shuffleFeedVideos(page.data, refreshEpoch + 1),
  }
}

/** Target distinct videos per page when chaining sparse timeline results. */
const MIN_VIDEOS_PER_PAGE = 3

function feedLoadError(context: string, error: unknown): never {
  if (error instanceof SessionExpiredError) {
    throw error
  }
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
 * Timeline includes non-video posts; chain fetches until we have enough distinct
 * videos or exhaust the cursor. Used for Following only — never for discovery tabs.
 */
async function fetchUntilVideoPage(
  fetchPage: (cursor: string | undefined) => Promise<{
    feed: AppBskyFeedDefs.FeedViewPost[]
    cursor?: string
  }>,
  pageParam: PageParam,
  maxFetches = FOLLOWING_MAX_CHAIN_FETCHES,
): Promise<FlipFeedPage> {
  let cursor = normalizeCursor(pageParam)
  const videos: FlipVideo[] = []
  const seenKeys = new Set<string>()
  let nextCursor: string | null = null

  for (let attempt = 0; attempt < maxFetches; attempt++) {
    const res = await fetchPage(cursor)
    const page = postsToFeedPage(res.feed, res.cursor)
    nextCursor = page.meta.next_cursor

    let added = 0
    for (const video of page.data) {
      const key = videoDedupeKey(video)
      if (!key || seenKeys.has(key)) {
        continue
      }
      seenKeys.add(key)
      videos.push(video)
      added++
    }

    const hasEnoughVideos = videos.length >= MIN_VIDEOS_PER_PAGE
    if (hasEnoughVideos || !nextCursor) {
      break
    }

    if (added === 0 && res.feed.length === 0) {
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

/** Bluesky official video feed (same as bsky.social "Videos" / thevids). */
export const BLUESKY_THE_VIDS =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/thevids'

/** Bluesky "What's Hot" — fallback discover when video feeds fail. */
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

type VideoSearchSort = 'latest' | 'top'

/** Single searchPosts request — global discovery, no timeline chaining. */
async function fetchSingleVideoSearchPage(
  pageParam: PageParam,
  options: { sort: VideoSearchSort; context: string; query?: string },
): Promise<FlipFeedPage> {
  const { sort, context, query = 'video' } = options
  const decoded = decodeFeedPageParam(pageParam)
  const apiCursor = decoded.cursor ?? normalizeCursor(pageParam)

  try {
    return await withAuthenticatedFetch(async () => {
      const agent = getAgent()
      const res = await agent.app.bsky.feed.searchPosts({
        q: query,
        sort,
        limit: DISCOVERY_SEARCH_LIMIT,
        cursor: apiCursor,
      })
      const feed = res.data.posts.map((post) => ({ post, reply: undefined }))
      return postsToFeedPage(feed, res.data.cursor)
    })
  } catch (error) {
    feedLoadError(context, error)
  }
}

/** Video feed generators return video posts — single request, no client-side chain. */
async function fetchGeneratorFeed(
  feedUri: string,
  pageParam: PageParam,
  context = 'feed',
): Promise<FlipFeedPage> {
  const decoded = decodeFeedPageParam(pageParam)
  const apiCursor = decoded.cursor ?? normalizeCursor(pageParam)
  try {
    return await withAuthenticatedFetch(async () => {
      const agent = getAgent()
      const res = await agent.app.bsky.feed.getFeed({
        feed: feedUri,
        limit: DISCOVERY_SEARCH_LIMIT,
        cursor: apiCursor,
      })
      return postsToFeedPage(res.data.feed, res.data.cursor)
    })
  } catch (error) {
    feedLoadError(context, error)
  }
}

export async function fetchFollowingFeed({
  pageParam = false,
  refreshEpoch = 0,
}: FeedFetchOptions = {}): Promise<FlipFeedPage> {
  const firstPage = isFirstFeedPage(pageParam)

  try {
    let page = await withAuthenticatedFetch(async () => {
      const agent = getAgent()
      const decoded = decodeFeedPageParam(pageParam)
      const apiCursor = decoded.cursor ?? normalizeCursor(pageParam)
      return await fetchUntilVideoPage(async (cursor) => {
        const res = await agent.getTimeline({
          limit: 50,
          cursor,
        })
        return { feed: res.data.feed, cursor: res.data.cursor }
      }, apiCursor)
    })

    // Only supplement when the timeline is completely empty — never merge discover into thin Following.
    if (firstPage && page.data.length === 0) {
      try {
        const supplement = await fetchSingleVideoSearchPage(false, {
          sort: refreshEpoch % 2 === 0 ? 'latest' : 'top',
          context: 'following suggestions',
          query: 'video',
        })
        if (supplement.data.length > 0) {
          page = supplement
        }
      } catch (supplementError) {
        if (supplementError instanceof SessionExpiredError) {
          throw supplementError
        }
        console.warn('[feed] following supplement search failed:', supplementError)
      }
    }

    if (firstPage) {
      page = finalizeFirstPage(page, refreshEpoch)
    }

    return page
  } catch (error) {
    feedLoadError('following feed', error)
  }
}

function pickForYouSource(refreshEpoch: number, customUri?: string): ForYouSourceId {
  if (customUri && customUri !== BLUESKY_THE_VIDS) {
    const withCustom: ForYouSourceId[] = ['custom', 'search-latest', 'search-top', 'whats-hot']
    return withCustom[refreshEpoch % withCustom.length]!
  }
  // Discovery first — thevids overlaps heavily with Following reposts.
  const pool: ForYouSourceId[] = ['search-latest', 'search-top', 'thevids', 'whats-hot']
  return pool[refreshEpoch % pool.length]!
}

function pickLocalSource(refreshEpoch: number): LocalSourceId {
  // First load: single generator request (fast). Rotate on pull-to-refresh only.
  if (refreshEpoch === 0) {
    return 'thevids'
  }
  const pool: LocalSourceId[] = ['thevids', 'search-latest', 'search-top']
  return pool[refreshEpoch % pool.length]!
}

async function fetchForYouBySource(
  sourceId: ForYouSourceId,
  cursor: string | undefined,
  customUri?: string,
): Promise<FlipFeedPage> {
  switch (sourceId) {
    case 'custom':
      return fetchGeneratorFeed(customUri || BLUESKY_THE_VIDS, cursor ?? false, 'for you feed')
    case 'search-latest':
      return fetchSingleVideoSearchPage(cursor ?? false, {
        sort: 'latest',
        context: 'for you feed',
      })
    case 'search-top':
      return fetchSingleVideoSearchPage(cursor ?? false, {
        sort: 'top',
        context: 'for you feed',
      })
    case 'whats-hot':
      return fetchGeneratorFeed(BLUESKY_WHATS_HOT, cursor ?? false, 'for you feed')
    case 'thevids':
    default:
      return fetchGeneratorFeed(BLUESKY_THE_VIDS, cursor ?? false, 'for you feed')
  }
}

async function fetchLocalBySource(
  sourceId: LocalSourceId,
  cursor: string | undefined,
  refreshEpoch: number,
): Promise<FlipFeedPage> {
  const query = refreshEpoch % 3 === 2 ? 'flip video' : 'video'

  switch (sourceId) {
    case 'search-top':
      return fetchSingleVideoSearchPage(cursor ?? false, {
        sort: 'top',
        context: 'local feed',
        query,
      })
    case 'search-latest':
      return fetchSingleVideoSearchPage(cursor ?? false, {
        sort: 'latest',
        context: 'local feed',
        query,
      })
    case 'thevids':
    default:
      return fetchGeneratorFeed(BLUESKY_THE_VIDS, cursor ?? false, 'local feed')
  }
}

export async function fetchForYouFeed({
  pageParam = false,
  refreshEpoch = 0,
}: FeedFetchOptions = {}): Promise<FlipFeedPage> {
  const customUri = getForYouFeedUri()
  const decoded = decodeFeedPageParam(pageParam)
  const firstPage = isFirstFeedPage(pageParam)

  let sourceId: ForYouSourceId
  let cursor: string | undefined

  if (decoded.sourceId) {
    sourceId = decoded.sourceId as ForYouSourceId
    cursor = decoded.cursor
  } else if (decoded.cursor) {
    sourceId = 'thevids'
    cursor = decoded.cursor
  } else {
    sourceId = pickForYouSource(refreshEpoch, customUri)
    cursor = undefined
  }

  try {
    let page = await fetchForYouBySource(sourceId, cursor, customUri)

    if (firstPage) {
      page = finalizeFirstPage(page, refreshEpoch)
    }

    const nextCursor = page.meta.next_cursor
    return {
      ...page,
      meta: {
        ...page.meta,
        next_cursor: nextCursor
          ? encodeFeedPageParam(sourceId, nextCursor)
          : null,
      },
    }
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      throw error
    }
    console.warn('[feed] for you source failed, trying fallbacks:', error)
    try {
      const page = await fetchSingleVideoSearchPage(false, {
        sort: refreshEpoch % 2 === 0 ? 'latest' : 'top',
        context: 'for you feed',
      })
      const finalized = firstPage ? finalizeFirstPage(page, refreshEpoch) : page
      const nextCursor = finalized.meta.next_cursor
      return {
        ...finalized,
        meta: {
          ...finalized.meta,
          next_cursor: nextCursor
            ? encodeFeedPageParam('search-top', nextCursor)
            : null,
        },
      }
    } catch (searchError) {
      if (searchError instanceof SessionExpiredError) {
        throw searchError
      }
      console.warn('[feed] for you video search failed, falling back to discover:', searchError)
      const page = await fetchGeneratorFeed(BLUESKY_WHATS_HOT, pageParam, 'for you feed')
      return firstPage ? finalizeFirstPage(page, refreshEpoch) : page
    }
  }
}

/**
 * Local tab — optional custom feed generator, else global video discovery.
 * Never uses getTimeline; rotates thevids + video search on refresh.
 */
export async function fetchLocalFeed({
  pageParam = false,
  refreshEpoch = 0,
}: FeedFetchOptions = {}): Promise<FlipFeedPage> {
  const customUri = getLocalFeedUri()
  const decoded = decodeFeedPageParam(pageParam)
  const firstPage = isFirstFeedPage(pageParam)

  if (customUri) {
    const page = await fetchGeneratorFeed(customUri, pageParam, 'local feed')
    const finalized = firstPage ? finalizeFirstPage(page, refreshEpoch) : page
    const nextCursor = finalized.meta.next_cursor
    return {
      ...finalized,
      meta: {
        ...finalized.meta,
        next_cursor: nextCursor
          ? encodeFeedPageParam('custom', nextCursor)
          : null,
      },
    }
  }

  let sourceId: LocalSourceId
  let cursor: string | undefined

  if (decoded.sourceId) {
    sourceId = decoded.sourceId as LocalSourceId
    cursor = decoded.cursor
  } else if (decoded.cursor) {
    sourceId = 'thevids'
    cursor = decoded.cursor
  } else {
    sourceId = pickLocalSource(refreshEpoch)
    cursor = undefined
  }

  let page: FlipFeedPage

  try {
    page = await fetchLocalBySource(sourceId, cursor, refreshEpoch)
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      feedLoadError('local feed', error)
    }
    console.warn('[feed] local discovery failed, trying video search once:', error)
    try {
      page = await fetchSingleVideoSearchPage(false, {
        sort: 'latest',
        context: 'local feed',
        query: 'video',
      })
      sourceId = 'search-latest'
    } catch (fallbackError) {
      if (fallbackError instanceof SessionExpiredError) {
        feedLoadError('local feed', fallbackError)
      }
      return {
        data: [],
        meta: {
          path: 'atproto',
          per_page: 0,
          next_cursor: null,
          error:
            'Could not load local videos. Configure flipLocalFeed for a geo feed, or try again later.',
        },
      }
    }
  }

  if (firstPage) {
    page = finalizeFirstPage(page, refreshEpoch)
  }

  const nextCursor = page.meta.next_cursor
  page = {
    ...page,
    meta: {
      ...page.meta,
      next_cursor: nextCursor ? encodeFeedPageParam(sourceId, nextCursor) : null,
    },
  }

  if (page.data.length === 0 && !page.meta.next_cursor && firstPage) {
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
    filter: 'posts_with_media',
    limit: 30,
    cursor: normalizeCursor(pageParam),
  })

  return postsToMediaPage(
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
    filter: 'posts_with_media',
    limit: 30,
    cursor: normalizeCursor(pageParam),
  })

  return postsToMediaPage(res.data.feed, res.data.cursor)
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
        filter: 'posts_with_media',
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

    return postsToMediaPage(items, feedRes.data.cursor)
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
