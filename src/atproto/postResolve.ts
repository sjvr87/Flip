import type { AppBskyFeedDefs } from '@atproto/api'
import { AppBskyFeedLike, AppBskyFeedRepost, AtUri } from '@atproto/api'

import { isMediaPost } from './adapters'
import type { getAgent } from './agent'

type Agent = ReturnType<typeof getAgent>

/** Resolve like/repost record URIs to the subject post URI. */
export async function normalizeToPostUri(agent: Agent, uri: string): Promise<string> {
  if (uri.includes('app.bsky.feed.post')) {
    return uri
  }

  try {
    const atUri = new AtUri(uri)
    if (atUri.collection === 'app.bsky.feed.repost' || atUri.collection === 'app.bsky.feed.like') {
      const record = await agent.com.atproto.repo.getRecord({
        repo: atUri.host,
        collection: atUri.collection,
        rkey: atUri.rkey,
      })
      const value = record.data.value
      if (AppBskyFeedRepost.isRecord(value) || AppBskyFeedLike.isRecord(value)) {
        const subjectUri = value.subject?.uri
        if (typeof subjectUri === 'string' && subjectUri.length > 0) {
          return subjectUri
        }
      }
    }
  } catch {
    // Fall through to caller resolution chain.
  }

  return uri
}

async function hydratePostView(agent: Agent, uri: string): Promise<AppBskyFeedDefs.PostView | null> {
  try {
    const res = await agent.getPostThread({ uri, depth: 0, parentHeight: 0 })
    const thread = res.data.thread
    if (thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
      return null
    }
    return thread.post
  } catch {
    return null
  }
}

async function resolveMediaPostViaThread(
  agent: Agent,
  uri: string,
): Promise<AppBskyFeedDefs.PostView | null> {
  try {
    const res = await agent.getPostThread({ uri, depth: 0, parentHeight: 12 })
    const thread = res.data.thread
    if (thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
      return null
    }

    let node: AppBskyFeedDefs.ThreadViewPost | undefined = thread
    while (node) {
      if (isMediaPost(node.post)) {
        return node.post
      }

      const parent = node.parent
      if (!parent || parent.$type !== 'app.bsky.feed.defs#threadViewPost') {
        break
      }
      node = parent
    }
  } catch {
    // Fall through to caller.
  }

  return null
}

/** Walk reply / like-record chains to the playable media post view. */
export async function resolveMediaPostView(
  agent: Agent,
  uri: string,
): Promise<AppBskyFeedDefs.PostView | null> {
  let currentUri: string | undefined = await normalizeToPostUri(agent, uri)
  const visited = new Set<string>()

  for (let depth = 0; depth < 8 && currentUri && !visited.has(currentUri); depth++) {
    visited.add(currentUri)
    currentUri = await normalizeToPostUri(agent, currentUri)

    let post: AppBskyFeedDefs.PostView | undefined
    try {
      const res = await agent.getPosts({ uris: [currentUri] })
      post = res.data.posts[0]
    } catch {
      break
    }

    if (!post || post.$type === 'app.bsky.feed.defs#notFoundPost') {
      break
    }

    if (!isMediaPost(post)) {
      const hydrated = await hydratePostView(agent, currentUri)
      if (hydrated) {
        post = hydrated
      }
    }

    if (isMediaPost(post)) {
      return post
    }

    const record = post.record as {
      reply?: { parent?: { uri?: string }; root?: { uri?: string } }
    }
    const parentUri = record?.reply?.parent?.uri
    if (parentUri) {
      currentUri = parentUri
      continue
    }

    const rootUri = record?.reply?.root?.uri
    if (rootUri && rootUri !== currentUri) {
      currentUri = rootUri
      continue
    }

    const embed = post.embed
    if (
      embed &&
      embed.$type === 'app.bsky.embed.record#view' &&
      'record' in embed &&
      (embed as { record?: { uri?: string } }).record?.uri
    ) {
      currentUri = (embed as { record: { uri: string } }).record.uri
      continue
    }

    break
  }

  return resolveMediaPostViaThread(agent, uri)
}
