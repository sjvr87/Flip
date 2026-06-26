import { hasAndroidMediaReadPermission } from '@/camera/ensureAndroidMediaReadPermissions';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { createVideoPlayer } from 'expo-video';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

function asFileUri(path: string): string {
    if (path.startsWith('file://') || path.startsWith('content://')) return path;
    return `file://${path}`;
}

function cachePathForAsset(assetId: string, suffix = ''): string {
    const safeId = assetId.replace(/[^a-zA-Z0-9-]/g, '_');
    return `${FileSystem.cacheDirectory}gallery-thumb-${safeId}${suffix}.jpg`;
}

/** Copy content:// (or remote) URIs into cache so Image can render them on Android. */
async function cacheUriForDisplay(uri: string, assetId: string, suffix = ''): Promise<string> {
    if (uri.startsWith('file://')) {
        const path = uri.slice('file://'.length);
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) return uri;
    }

    const dest = cachePathForAsset(assetId, suffix);
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists) return asFileUri(dest);

    await FileSystem.copyAsync({ from: uri, to: dest });
    return asFileUri(dest);
}

async function resolveAssetUri(asset: MediaLibrary.Asset): Promise<string | null> {
    const candidates: string[] = [];

    try {
        const info = await MediaLibrary.getAssetInfoAsync(asset, {
            shouldDownloadFromNetwork: true,
        });
        if (info.localUri) candidates.push(info.localUri);
        if (info.uri) candidates.push(info.uri);
    } catch {
        // fall through to asset.uri
    }

    if (asset.uri) candidates.push(asset.uri);

    const seen = new Set<string>();
    for (const raw of candidates) {
        if (!raw || seen.has(raw)) continue;
        seen.add(raw);
        try {
            return await cacheUriForDisplay(raw, asset.id);
        } catch {
            try {
                return asFileUri(raw);
            } catch {
                continue;
            }
        }
    }

    return null;
}

async function videoThumbnailFromUri(uri: string, assetId: string): Promise<string | null> {
    let fileUri = uri;
    try {
        fileUri = await cacheUriForDisplay(uri, assetId, '-src');
    } catch {
        // use original uri
    }

    const player = createVideoPlayer(fileUri);
    try {
        await player.replaceAsync(fileUri);
        const thumbs = await player.generateThumbnailsAsync([0], { maxWidth: 200, maxHeight: 200 });
        const thumb = thumbs[0];
        if (!thumb) return null;
        if (typeof thumb === 'string') return asFileUri(thumb);
        if (typeof thumb === 'object' && thumb && 'uri' in thumb) {
            return asFileUri(String((thumb as { uri: string }).uri));
        }
        return null;
    } catch {
        return null;
    } finally {
        player.release?.();
    }
}

async function loadLatestResolvableThumb(): Promise<string | null> {
    const queryAssets = async (mediaType: MediaLibrary.MediaTypeValue) => {
        try {
            const { assets } = await MediaLibrary.getAssetsAsync({
                first: 12,
                mediaType,
                sortBy: [['modificationTime', false]],
            });
            return assets;
        } catch {
            return [];
        }
    };

    const photos = await queryAssets(MediaLibrary.MediaType.photo);
    const videos = await queryAssets(MediaLibrary.MediaType.video);
    const ordered = [...photos, ...videos].sort(
        (a, b) =>
            (b.modificationTime ?? b.creationTime ?? 0) -
            (a.modificationTime ?? a.creationTime ?? 0),
    );

    for (const asset of ordered) {
        const uri = await resolveAssetUri(asset);
        if (!uri) continue;

        if (asset.mediaType === MediaLibrary.MediaType.photo) {
            return uri;
        }

        const videoThumb = await videoThumbnailFromUri(uri, asset.id);
        if (videoThumb) return videoThumb;
    }

    return null;
}

/** Most recent gallery photo or video thumbnail for the Create upload tile (Android). */
export function useRecentGalleryThumb() {
    const [thumbUri, setThumbUri] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const cancelledRef = useRef(false);

    const reload = useCallback(() => setReloadToken((t) => t + 1), []);

    const load = useCallback(async () => {
        cancelledRef.current = false;
        try {
            const canRead = await hasAndroidMediaReadPermission();
            if (!canRead) {
                if (!cancelledRef.current) setThumbUri(null);
                return;
            }
            const nextThumb = await loadLatestResolvableThumb();
            if (!cancelledRef.current) setThumbUri(nextThumb);
        } catch {
            if (!cancelledRef.current) setThumbUri(null);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            cancelledRef.current = false;
            load();
            return () => {
                cancelledRef.current = true;
            };
        }, [load, reloadToken]),
    );

    return { thumbUri, reload };
}
