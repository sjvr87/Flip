export function encodeRouteParam(value: string): string {
  return encodeURIComponent(value)
}

export function decodeRouteParam(value: string | string[] | undefined): string {
  if (!value) return ''
  const raw = Array.isArray(value) ? value[0] : value

  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function toProfilePath(profileId: string): string {
  return `/private/profile/${encodeRouteParam(profileId)}`
}

export function toProfileFeedPath(videoId: string, profileId: string): string {
  return `/private/profile/feed/${encodeRouteParam(videoId)}?profileId=${encodeRouteParam(profileId)}`
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
