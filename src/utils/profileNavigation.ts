export function encodeRouteParam(value: string): string {
  return encodeURIComponent(value)
}

export function decodeRouteParam(value: string | string[] | undefined): string {
  if (!value) return ''
  let raw = Array.isArray(value) ? value[0] : value

  // Expo Router may encode AT URIs more than once when passed as params.
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(raw)
      if (decoded === raw) break
      raw = decoded
    } catch {
      break
    }
  }

  return raw
}

export function parseRepoDidFromAtUri(uri: string): string | undefined {
  const match = uri.match(/^at:\/\/(did:[^/]+)/)
  return match?.[1]
}

/** Web URL for an ATProto post URI (works with DID or handle in path). */
export function postAtUriToBskyUrl(uri: string): string | undefined {
  const match = uri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)/)
  if (!match) return undefined
  return `https://bsky.app/profile/${match[1]}/post/${match[2]}`
}

export function toProfilePath(profileId: string) {
  return {
    pathname: '/private/profile/[id]' as const,
    params: { id: encodeRouteParam(profileId) },
  }
}

type ProfileFeedNavOptions = {
  openComments?: boolean
  mediaKind?: 'video' | 'photo'
}

export function toProfileFeedPath(
  videoId: string,
  profileId: string,
  options?: ProfileFeedNavOptions,
) {
  const params: Record<string, string> = {
    id: encodeRouteParam(videoId),
    profileId: encodeRouteParam(profileId),
  }

  if (options?.openComments) {
    params.openComments = '1'
  }

  if (options?.mediaKind) {
    params.mediaKind = options.mediaKind
  }

  return {
    pathname: '/private/profile/feed/[id]' as const,
    params,
  }
}

type PostViewNavOptions = {
  openComments?: boolean
}

/** Direct single-post viewer — avoids author-feed pagination for notification deep links. */
export function toPostViewPath(postUri: string, options?: PostViewNavOptions) {
  const params: Record<string, string> = {
    uri: encodeRouteParam(postUri),
  }

  if (options?.openComments) {
    params.openComments = '1'
  }

  return {
    pathname: '/private/post/[uri]' as const,
    params,
  }
}

type PlaylistNav = {
  id?: string | number | null
  name?: string | null
  videos_count?: number | string | null
  video_count?: number | string | null
}

export function toPlaylistFeedRoute(playlist: PlaylistNav) {
  const id = playlist?.id
  if (id == null || id === '') return null

  const count = playlist.videos_count ?? playlist.video_count
  const params: Record<string, string> = {
    id: String(id),
    playlistName: playlist.name?.trim() || 'Playlist',
  }

  if (count != null && count !== '' && Number(count) > 0) {
    params.videoCount = String(count)
  }

  return {
    pathname: '/private/video/playlist/[id]' as const,
    params,
  }
}
