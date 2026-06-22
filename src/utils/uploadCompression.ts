import { getFeedNetworkProfile } from '@/utils/feedNetworkQuality';
import { FLIP_ANDROID_CAPTURE } from '@/camera/camerawesome/config';
import { Image as ImageCompressor, Video as VideoCompressor } from 'react-native-compressor';
import { Platform } from 'react-native';

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

async function getFileSizeBytes(uri: string): Promise<number> {
    const path = uri.startsWith('file://') ? uri : `file://${uri}`;
    if (Platform.OS === 'web') return 0;
    try {
        const { File } = await import('expo-file-system');
        const file = new File(path);
        return file.exists ? file.size ?? 0 : 0;
    } catch {
        return 0;
    }
}

/** Returns a file:// URI ready for multipart upload. */
export async function prepareVideoForUpload(
    originalPath: string,
    onProgress?: (pct: number) => void,
): Promise<string> {
    const policy = getUploadCompressionPolicy();
    const sizeBytes = await getFileSizeBytes(originalPath);

    if (policy.skipVideoReencode && sizeBytes > 0 && sizeBytes <= UPLOAD_MAX_VIDEO_BYTES_WIFI) {
        return originalPath.startsWith('file://') ? originalPath : `file://${originalPath}`;
    }

    const compressedUri = await VideoCompressor.compress(
        originalPath,
        {
            maxSize: policy.videoMaxSize,
            compressionMethod: policy.videoCompressionMethod,
        },
        (progress) => onProgress?.(Math.round(progress * 100)),
    );

    return compressedUri.startsWith('file://') ? compressedUri : `file://${compressedUri}`;
}

export async function prepareImageForUpload(originalPath: string): Promise<string> {
    const policy = getUploadCompressionPolicy();
    const sizeBytes = await getFileSizeBytes(originalPath);

    if (policy.imageQuality >= 1 && sizeBytes > 0 && sizeBytes <= UPLOAD_MAX_IMAGE_BYTES_WIFI) {
        return originalPath.startsWith('file://') ? originalPath : `file://${originalPath}`;
    }

    const compressedUri = await ImageCompressor.compress(originalPath, {
        maxWidth: policy.imageMaxWidth,
        maxHeight: policy.imageMaxHeight,
        quality: policy.imageQuality,
    });

    return compressedUri.startsWith('file://') ? compressedUri : `file://${compressedUri}`;
}
