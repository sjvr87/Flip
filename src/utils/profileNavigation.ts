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
