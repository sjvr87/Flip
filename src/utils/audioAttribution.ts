import type { FlipAudioSource, FlipVideo } from '@/atproto/types'

export function resolveAudioSource(item: FlipVideo): FlipAudioSource {
  if (item.audioSource) {
    return item.audioSource
  }
  return {
    username: item.account.username,
    profileId: item.account.id,
    postUri: item.id,
    isOriginal: true,
  }
}

export function isOriginalAudio(item: FlipVideo): boolean {
  const src = resolveAudioSource(item)
  return src.isOriginal !== false && src.postUri === item.id
}

export function audioAttributionLabel(item: FlipVideo): string {
  const src = resolveAudioSource(item)
  if (isOriginalAudio(item)) {
    return 'Original Audio'
  }
  return `@${src.username}`
}
