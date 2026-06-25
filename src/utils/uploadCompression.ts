import { getFeedNetworkProfile } from '@/utils/feedNetworkQuality';
import { FLIP_ANDROID_CAPTURE } from '@/camera/camerawesome/config';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ImageCompressor, Video as VideoCompressor } from 'react-native-compressor';
import { Platform } from 'react-native';

const VIDEO_COMPRESS_TIMEOUT_MS = 3 * 60 * 1000;

/** Loops studio upload — server accepts large blobs; stay under typical reverse-proxy limits. */
export const UPLOAD_MAX_VIDEO_BYTES_WIFI = 50 * 1024 * 1024;
export const UPLOAD_MAX_IMAGE_BYTES_WIFI = 10 * 1024 * 1024;
export const UPLOAD_MAX_VIDEO_BYTES_CELLULAR = 35 * 1024 * 1024;

export type UploadCompressionPolicy = {
    skipVideoReencode: boolean;
    videoMaxSize: number;
    videoCompressionMethod: 'auto' | 'manual';
    videoMinBitrate?: number;
    imageQuality: number;
    imageMaxWidth: number;
    imageMaxHeight: number;
};

export type PrepareVideoOptions = {
    /** Flip camera already encodes 1080p H.264 — skip re-encode when under upload cap. */
    fromFlipCamera?: boolean;
};

export function getUploadCompressionPolicy(): UploadCompressionPolicy {
    const tier = getFeedNetworkProfile().tier;

    if (tier === 'wifi') {
        return {
            skipVideoReencode: true,
            videoMaxSize: 3840,
            videoCompressionMethod: 'manual',
            videoMinBitrate: FLIP_ANDROID_CAPTURE.flagship.videoBitrate,
            imageQuality: 1,
            imageMaxWidth: 4096,
            imageMaxHeight: 4096,
        };
    }

    if (tier === 'cellular') {
        return {
            skipVideoReencode: false,
            videoMaxSize: 1920,
            videoCompressionMethod: 'auto',
            videoMinBitrate: 8_000_000,
            imageQuality: 0.92,
            imageMaxWidth: 1920,
            imageMaxHeight: 1920,
        };
    }

    return {
        skipVideoReencode: false,
        videoMaxSize: 1280,
        videoCompressionMethod: 'auto',
        imageQuality: 0.85,
        imageMaxWidth: 1280,
        imageMaxHeight: 1280,
    };
}

function normalizeFileUri(uri: string): string {
    return uri.startsWith('file://') ? uri : `file://${uri}`;
}

async function getFileSizeBytes(uri: string): Promise<number> {
    const path = normalizeFileUri(uri);
    if (Platform.OS === 'web') return 0;

    try {
        const { File } = await import('expo-file-system');
        const file = new File(path);
        if (file.exists && (file.size ?? 0) > 0) {
            return file.size ?? 0;
        }
    } catch {
        // fall through to legacy API
    }

    try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0) {
            return info.size;
        }
    } catch {
        // unknown size
    }

    return 0;
}

function shouldSkipVideoReencode(
    policy: UploadCompressionPolicy,
    sizeBytes: number,
    options?: PrepareVideoOptions,
): boolean {
    const withinWifiCap = sizeBytes <= 0 || sizeBytes <= UPLOAD_MAX_VIDEO_BYTES_WIFI;

    if (options?.fromFlipCamera && withinWifiCap) {
        return true;
    }

    if (policy.skipVideoReencode && withinWifiCap) {
        return true;
    }

    return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
        }, ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/** Returns a file:// URI ready for multipart upload. */
export async function prepareVideoForUpload(
    originalPath: string,
    onProgress?: (pct: number) => void,
    options?: PrepareVideoOptions,
): Promise<string> {
    const policy = getUploadCompressionPolicy();
    const sizeBytes = await getFileSizeBytes(originalPath);
    const normalized = normalizeFileUri(originalPath);

    if (shouldSkipVideoReencode(policy, sizeBytes, options)) {
        if (__DEV__) {
            console.log(
                '[upload] skipping video re-encode',
                options?.fromFlipCamera ? '(flip camera)' : `(tier=${policy.skipVideoReencode ? 'wifi' : 'other'})`,
                sizeBytes > 0 ? `${Math.round(sizeBytes / 1024 / 1024)}MB` : 'size unknown',
            );
        }
        return normalized;
    }

    onProgress?.(0);

    try {
        const compressedUri = await withTimeout(
            VideoCompressor.compress(
                originalPath,
                {
                    maxSize: policy.videoMaxSize,
                    compressionMethod: policy.videoCompressionMethod,
                },
                (progress) => onProgress?.(Math.round(progress * 100)),
            ),
            VIDEO_COMPRESS_TIMEOUT_MS,
            'Video compression',
        );

        return normalizeFileUri(compressedUri);
    } catch (error) {
        if (__DEV__) {
            console.warn('[upload] video compression failed, uploading original:', error);
        }
        return normalized;
    }
}

export async function prepareImageForUpload(originalPath: string): Promise<string> {
    const policy = getUploadCompressionPolicy();
    const sizeBytes = await getFileSizeBytes(originalPath);

    if (policy.imageQuality >= 1 && sizeBytes > 0 && sizeBytes <= UPLOAD_MAX_IMAGE_BYTES_WIFI) {
        return normalizeFileUri(originalPath);
    }

    const compressedUri = await ImageCompressor.compress(originalPath, {
        maxWidth: policy.imageMaxWidth,
        maxHeight: policy.imageMaxHeight,
        quality: policy.imageQuality,
    });

    return normalizeFileUri(compressedUri);
}
