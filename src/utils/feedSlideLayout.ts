import { PixelRatio } from 'react-native';

/** Bleed media slightly past slide bounds — hides sub-pixel cover-fit gaps at edges. */
export const FEED_MEDIA_EDGE_BLEED = 2;

/**
 * Overlap adjacent FlatList cells by 1px so scroll seams never show container black.
 * Stride between slide starts = slideHeight - FEED_CELL_OVERLAP.
 */
export const FEED_CELL_OVERLAP = 1;

/** Pixel-align slide height for snap / getItemLayout. */
export function getFeedSlideHeight(height: number): number {
    if (!Number.isFinite(height) || height <= 0) {
        return 0;
    }
    return PixelRatio.roundToNearestPixel(height);
}

export function getFeedItemStride(slideHeight: number): number {
    return Math.max(1, slideHeight - FEED_CELL_OVERLAP);
}
