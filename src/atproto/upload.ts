import { AppBskyEmbedVideo, AtpAgent, type BlobRef } from '@atproto/api'
import { File } from 'expo-file-system'
import { Image } from 'react-native'

import { getAgent } from './agent'
import type { FlipAudioSource, FlipPermissions } from './types'

export type AtprotoUploadOptions = {
  fileUri: string
  caption?: string
  altText?: string
  lang?: string
  isSensitive?: boolean
  isPhoto?: boolean
  onProgress?: (message: string) => void
  permissions?: Partial<FlipPermissions>
  audioSource?: FlipAudioSource
}

export type AtprotoUploadResult = {
  uri: string
  cid: string
}

const VIDEO_PROCESS_TIMEOUT_MS = 10 * 60 * 1000
const VIDEO_POLL_INTERVAL_MS = 1000

async function readFileBytes(uri: string): Promise<Uint8Array> {
  const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`
  const file = new File(fileUri)
  if (!file.exists) {
    throw new Error('Media file not found. Try capturing again.')
  }
  return file.bytes()
}

async function getImageDimensions(
  uri: string,
): Promise<{ width: number; height: number }> {
  const src = uri.startsWith('file://') ? uri : `file://${uri}`
  return new Promise((resolve, reject) => {
    Image.getSize(src, (width, height) => resolve({ width, height }), reject)
  })
}

function selfLabels(isSensitive: boolean) {
  if (!isSensitive) return undefined
  return {
    $type: 'com.atproto.label.defs#selfLabels' as const,
    values: [{ val: '!warn', neg: false as const }],
  }
}

function flipRecordExtension(options: AtprotoUploadOptions) {
  const permissions = options.permissions
  const audioSource = options.audioSource
  if (!permissions && !audioSource) return undefined

  return {
    permissions: permissions
      ? {
          can_comment: permissions.can_comment,
          can_download: permissions.can_download,
          can_duet: permissions.can_duet,
          can_stitch: permissions.can_stitch,
          can_use_audio: permissions.can_use_audio,
        }
      : undefined,
    audioSource: audioSource
      ? {
          username: audioSource.username,
          profileId: audioSource.profileId,
          postUri: audioSource.postUri,
          isOriginal: audioSource.isOriginal,
        }
      : undefined,
  }
}

function postRecordBase(options: AtprotoUploadOptions, langs: string[], labels: ReturnType<typeof selfLabels>) {
  const flip = flipRecordExtension(options)
  return {
    text: options.caption || '',
    langs,
    labels,
    ...(flip ? { flip } : {}),
    createdAt: new Date().toISOString(),
  }
}

async function uploadVideoViaService(
  agent: ReturnType<typeof getAgent>,
  bytes: Uint8Array,
  fileUri: string,
  onProgress?: (message: string) => void,
): Promise<BlobRef> {
  if (!agent.session) throw new Error('Not authenticated')

  const pdsHost = agent.dispatchUrl.host
  const { data: serviceAuth } = await agent.com.atproto.server.getServiceAuth({
    aud: `did:web:${pdsHost}`,
    lxm: 'com.atproto.repo.uploadBlob',
    exp: Math.floor(Date.now() / 1000) + 60 * 30,
  })

  const filename = fileUri.split('/').pop() || `upload_${Date.now()}.mp4`
  const uploadUrl = new URL('https://video.bsky.app/xrpc/app.bsky.video.uploadVideo')
  uploadUrl.searchParams.set('did', agent.session.did)
  uploadUrl.searchParams.set('name', filename)

  onProgress?.('Uploading video…')

  const uploadResponse = await fetch(uploadUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceAuth.token}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(bytes.byteLength),
    },
    body: bytes,
  })

  const responseText = await uploadResponse.text()
  let jobStatus: {
    jobId?: string
    blob?: BlobRef
    error?: string
    message?: string
  }
  try {
    jobStatus = JSON.parse(responseText) as typeof jobStatus
  } catch {
    throw new Error(
      `Video upload failed (${uploadResponse.status}): ${responseText.slice(0, 200) || 'invalid response'}`,
    )
  }

  if (!uploadResponse.ok && !jobStatus.blob) {
    throw new Error(jobStatus.message || jobStatus.error || 'Video upload failed')
  }

  let blob: BlobRef | undefined = jobStatus.blob
  const videoAgent = new AtpAgent({ service: 'https://video.bsky.app' })
  const startedAt = Date.now()

  while (!blob && jobStatus.jobId) {
    if (Date.now() - startedAt > VIDEO_PROCESS_TIMEOUT_MS) {
      throw new Error('Video processing timed out. Try again with a shorter clip.')
    }

    onProgress?.('Processing video…')
    const { data: status } = await videoAgent.app.bsky.video.getJobStatus({
      jobId: jobStatus.jobId,
    })

    if (status.jobStatus.blob) {
      blob = status.jobStatus.blob
      break
    }

    if (status.jobStatus.state === 'failed') {
      throw new Error(status.jobStatus.error || 'Video processing failed')
    }

    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS))
  }

  if (!blob) {
    throw new Error('Video processing did not return a blob')
  }

  return blob
}

export async function uploadMediaPost(
  options: AtprotoUploadOptions,
): Promise<AtprotoUploadResult> {
  const agent = getAgent()
  if (!agent.session) {
    throw new Error('Not authenticated')
  }

  options.onProgress?.('Reading media…')
  const bytes = await readFileBytes(options.fileUri)
  const langs = options.lang ? [options.lang] : ['en']
  const labels = selfLabels(!!options.isSensitive)

  if (options.isPhoto) {
    options.onProgress?.('Uploading photo…')
    const [uploadResult, aspectRatio] = await Promise.all([
      agent.uploadBlob(bytes, { encoding: 'image/jpeg' }),
      getImageDimensions(options.fileUri).catch(() => ({
        width: 1,
        height: 1,
      })),
    ])
    const { data } = uploadResult

    options.onProgress?.('Posting…')
    const result = await agent.post({
      ...postRecordBase(options, langs, labels),
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          {
            alt: options.altText || '',
            image: data.blob,
            aspectRatio,
          },
        ],
      },
    })

    return { uri: result.uri, cid: result.cid }
  }

  const blob = await uploadVideoViaService(
    agent,
    bytes,
    options.fileUri,
    options.onProgress,
  )

  options.onProgress?.('Posting…')
  const result = await agent.post({
    ...postRecordBase(options, langs, labels),
    embed: {
      $type: 'app.bsky.embed.video',
      video: blob,
      aspectRatio: { width: 9, height: 16 },
    } satisfies AppBskyEmbedVideo.Main,
  })

  return { uri: result.uri, cid: result.cid }
}
