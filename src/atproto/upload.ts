import { AppBskyEmbedVideo, AtpAgent, type BlobRef } from '@atproto/api';
import { File, UploadType } from 'expo-file-system';
import { Image } from 'react-native';

import { getAgent, getPdsDispatchUrl, isOAuthAuthenticated } from './agent';
import type { FlipAudioSource, FlipPermissions } from './types';

export type AtprotoUploadOptions = {
    fileUri: string;
    caption?: string;
    altText?: string;
    lang?: string;
    isSensitive?: boolean;
    isPhoto?: boolean;
    onProgress?: (message: string) => void;
    permissions?: Partial<FlipPermissions>;
    audioSource?: FlipAudioSource;
};

export type AtprotoUploadResult = {
    uri: string;
    cid: string;
};

const VIDEO_PROCESS_TIMEOUT_MS = 10 * 60 * 1000;
const VIDEO_POLL_INTERVAL_MS = 1000;

function getMediaFile(uri: string): File {
    const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    const file = new File(fileUri);
    if (!file.exists) {
        throw new Error('Media file not found. Try capturing again.');
    }
    return file;
}

/** Native binary upload — streams from disk without loading the file into JS heap. */
async function uploadFileBinary(
    file: File,
    url: string,
    contentType: string,
    authToken: string,
    onProgress?: (message: string) => void,
): Promise<{ status: number; body: string }> {
    return file.upload(url, {
        httpMethod: 'POST',
        uploadType: UploadType.BINARY_CONTENT,
        mimeType: contentType,
        headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': contentType,
        },
        onProgress: ({ bytesSent, totalBytes }) => {
            if (totalBytes > 0 && onProgress) {
                const pct = Math.round((bytesSent / totalBytes) * 100);
                onProgress(`Uploading… ${pct}%`);
            }
        },
    });
}

async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    const src = uri.startsWith('file://') ? uri : `file://${uri}`;
    return new Promise((resolve, reject) => {
        Image.getSize(src, (width, height) => resolve({ width, height }), reject);
    });
}

function selfLabels(isSensitive: boolean) {
    if (!isSensitive) return undefined;
    return {
        $type: 'com.atproto.label.defs#selfLabels' as const,
        values: [{ val: '!warn', neg: false as const }],
    };
}

function flipRecordExtension(options: AtprotoUploadOptions) {
    const permissions = options.permissions;
    const audioSource = options.audioSource;
    if (!permissions && !audioSource) return undefined;

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
    };
}

function postRecordBase(
    options: AtprotoUploadOptions,
    langs: string[],
    labels: ReturnType<typeof selfLabels>,
) {
    const flip = flipRecordExtension(options);
    return {
        text: options.caption || '',
        langs,
        labels,
        ...(flip ? { flip } : {}),
        createdAt: new Date().toISOString(),
    };
}

function isOAuthScopeError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('Missing required scope') || message.includes('ScopeMissing');
}

function reauthRequiredForUpload(error: unknown): never {
    if (isOAuthScopeError(error) && isOAuthAuthenticated()) {
        throw new Error(
            'Upload needs updated Bluesky permissions. Sign out and sign in again, then retry.',
        );
    }
    throw error;
}

/** PDS service-auth for uploadBlob — required for video and OAuth fallback for photos. */
async function getBlobUploadServiceAuth(
    agent: ReturnType<typeof getAgent>,
    pdsUrl: URL,
) {
    if (!agent.session) throw new Error('Not authenticated');

    const pdsHost = pdsUrl.host;
    try {
        const { data: serviceAuth } = await agent.com.atproto.server.getServiceAuth({
            aud: `did:web:${pdsHost}`,
            lxm: 'com.atproto.repo.uploadBlob',
            exp: Math.floor(Date.now() / 1000) + 60 * 30,
        });
        return serviceAuth;
    } catch (error) {
        reauthRequiredForUpload(error);
    }
}

function parseUploadError(responseText: string, status: number, label: string): never {
    let message = responseText.slice(0, 300) || 'invalid response';
    try {
        const parsed = JSON.parse(responseText) as { message?: string; error?: string };
        message = parsed.message || parsed.error || message;
    } catch {
        // keep slice
    }
    throw new Error(`${label} (${status}): ${message}`);
}

/** OAuth with blob:*/* can upload directly; smaller photos only (loads into heap). */
async function uploadPhotoBlobViaOAuth(
    agent: ReturnType<typeof getAgent>,
    file: File,
    onProgress?: (message: string) => void,
): Promise<BlobRef> {
    onProgress?.('Uploading photo…');
    const bytes = await file.bytes();
    const { data } = await agent.uploadBlob(bytes, { encoding: 'image/jpeg' });
    return data.blob;
}

async function uploadPhotoBlobViaService(
    agent: ReturnType<typeof getAgent>,
    file: File,
    onProgress?: (message: string) => void,
): Promise<BlobRef> {
    const pdsUrl = await getPdsDispatchUrl(agent);
    const serviceAuth = await getBlobUploadServiceAuth(agent, pdsUrl);
    const uploadUrl = new URL('/xrpc/com.atproto.repo.uploadBlob', pdsUrl);

    onProgress?.('Uploading photo…');

    const { status, body: responseText } = await uploadFileBinary(
        file,
        uploadUrl.toString(),
        'image/jpeg',
        serviceAuth.token,
        onProgress,
    );

    if (status < 200 || status >= 300) {
        parseUploadError(responseText, status, 'Photo upload failed');
    }

    const data = JSON.parse(responseText) as { blob: BlobRef };
    return data.blob;
}

async function uploadPhotoBlob(
    agent: ReturnType<typeof getAgent>,
    file: File,
    onProgress?: (message: string) => void,
): Promise<BlobRef> {
    if (isOAuthAuthenticated()) {
        try {
            return await uploadPhotoBlobViaOAuth(agent, file, onProgress);
        } catch (error) {
            if (!isOAuthScopeError(error)) throw error;
        }
    }
    return uploadPhotoBlobViaService(agent, file, onProgress);
}

async function uploadVideoViaService(
    agent: ReturnType<typeof getAgent>,
    file: File,
    onProgress?: (message: string) => void,
): Promise<BlobRef> {
    const pdsUrl = await getPdsDispatchUrl(agent);
    const serviceAuth = await getBlobUploadServiceAuth(agent, pdsUrl);

    const filename = file.name || `upload_${Date.now()}.mp4`;
    const uploadUrl = new URL('https://video.bsky.app/xrpc/app.bsky.video.uploadVideo');
    uploadUrl.searchParams.set('did', agent.session!.did);
    uploadUrl.searchParams.set('name', filename);

    onProgress?.('Uploading video…');

    const { status, body: responseText } = await uploadFileBinary(
        file,
        uploadUrl.toString(),
        'video/mp4',
        serviceAuth.token,
        onProgress,
    );

    let jobStatus: {
        jobId?: string;
        blob?: BlobRef;
        error?: string;
        message?: string;
    };
    try {
        jobStatus = JSON.parse(responseText) as typeof jobStatus;
    } catch {
        throw new Error(
            `Video upload failed (${status}): ${responseText.slice(0, 200) || 'invalid response'}`,
        );
    }

    if ((status < 200 || status >= 300) && !jobStatus.blob) {
        throw new Error(jobStatus.message || jobStatus.error || 'Video upload failed');
    }

    let blob: BlobRef | undefined = jobStatus.blob;
    const videoAgent = new AtpAgent({ service: 'https://video.bsky.app' });
    const startedAt = Date.now();

    while (!blob && jobStatus.jobId) {
        if (Date.now() - startedAt > VIDEO_PROCESS_TIMEOUT_MS) {
            throw new Error('Video processing timed out. Try again with a shorter clip.');
        }

        onProgress?.('Processing video…');
        const { data: status } = await videoAgent.app.bsky.video.getJobStatus({
            jobId: jobStatus.jobId,
        });

        if (status.jobStatus.blob) {
            blob = status.jobStatus.blob;
            break;
        }

        if (status.jobStatus.state === 'failed') {
            throw new Error(status.jobStatus.error || 'Video processing failed');
        }

        await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
    }

    if (!blob) {
        throw new Error('Video processing did not return a blob');
    }

    return blob;
}

export async function uploadMediaPost(options: AtprotoUploadOptions): Promise<AtprotoUploadResult> {
    const agent = getAgent();
    if (!agent.session) {
        throw new Error('Not authenticated');
    }

    const file = getMediaFile(options.fileUri);
    const langs = options.lang ? [options.lang] : ['en'];
    const labels = selfLabels(!!options.isSensitive);

    if (options.isPhoto) {
        const [blob, aspectRatio] = await Promise.all([
            uploadPhotoBlob(agent, file, options.onProgress),
            getImageDimensions(options.fileUri).catch(() => ({
                width: 1,
                height: 1,
            })),
        ]);

        options.onProgress?.('Posting…');
        const result = await agent.post({
            ...postRecordBase(options, langs, labels),
            embed: {
                $type: 'app.bsky.embed.images',
                images: [
                    {
                        alt: options.altText || '',
                        image: blob,
                        aspectRatio,
                    },
                ],
            },
        });

        return { uri: result.uri, cid: result.cid };
    }

    const blob = await uploadVideoViaService(agent, file, options.onProgress);

    options.onProgress?.('Posting…');
    const result = await agent.post({
        ...postRecordBase(options, langs, labels),
        embed: {
            $type: 'app.bsky.embed.video',
            video: blob,
            aspectRatio: { width: 9, height: 16 },
        } satisfies AppBskyEmbedVideo.Main,
    });

    return { uri: result.uri, cid: result.cid };
}
