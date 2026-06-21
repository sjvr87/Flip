import { AppBskyFeedLike, AppBskyFeedRepost, AtUri } from '@atproto/api'

import type { getAgent } from './agent'

/** Resolve like/repost record URIs to the subject post URI. */
export async function normalizeToPostUri(
  agent: ReturnType<typeof getAgent>,
  uri: string,
): Promise<string> {
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
