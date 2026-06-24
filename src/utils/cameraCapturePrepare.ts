import { releaseAllFeedPlayers } from '@/utils/feedPlaybackGuard';
import { releaseAllVideoPrefetch } from '@/utils/videoPrefetch';

/**
 * Free MediaCodec / expo-video decoders before opening camera or remix record.
 * Feed players must not keep decoding the same stream ReferenceAudioPlayer uses.
 */
export function prepareForCameraCapture(): void {
    releaseAllFeedPlayers();
    releaseAllVideoPrefetch();
}
