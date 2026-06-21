import { Image } from 'expo-image';

const prefetched = new Set<string>();
const MAX_THUMBNAIL_PREFETCH = 16;

/** Warm thumbnail/avatar URLs into expo-image disk cache (safe on Android). */
export function prefetchThumbnails(urls: (string | undefined | null)[]): void {
    const unique = urls.filter((url): url is string => Boolean(url) && !prefetched.has(url));
    for (const url of unique.slice(0, MAX_THUMBNAIL_PREFETCH)) {
        prefetched.add(url);
        void Image.prefetch(url, { cachePolicy: 'memory-disk' }).catch(() => {
            prefetched.delete(url);
        });
    }
}
