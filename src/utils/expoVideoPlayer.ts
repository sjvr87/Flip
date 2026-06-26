import type { VideoPlayer } from 'expo-video';

/** True when expo-video native shared object is still alive (throws after release). */
export function isExpoVideoPlayerUsable(
    player: VideoPlayer | null | undefined,
): player is VideoPlayer {
    if (!player) {
        return false;
    }
    try {
        void player.status;
        return typeof player.addListener === 'function';
    } catch {
        return false;
    }
}
