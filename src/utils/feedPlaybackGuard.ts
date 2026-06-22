/** Tracks whether the home feed should decode video or warm HLS prefetch. */
let feedPlaybackActive = true;

type PlayerPauseFn = () => void;
const registeredPlayers = new Set<PlayerPauseFn>();
const playbackActiveListeners = new Set<(active: boolean) => void>();

export function isFeedPlaybackActive(): boolean {
    return feedPlaybackActive;
}

export function subscribeFeedPlaybackActive(listener: (active: boolean) => void): () => void {
    playbackActiveListeners.add(listener);
    listener(feedPlaybackActive);
    return () => playbackActiveListeners.delete(listener);
}

/** Register a pause handler for an mounted feed player (home feed, post viewer, etc.). */
export function registerFeedPlayer(pause: PlayerPauseFn): () => void {
    registeredPlayers.add(pause);
    if (!feedPlaybackActive) {
        try {
            pause();
        } catch {
            // player may already be released
        }
    }
    return () => registeredPlayers.delete(pause);
}

/** Immediately pause every registered expo-video player. */
export function pauseAllFeedPlayers(): void {
    for (const pause of registeredPlayers) {
        try {
            pause();
        } catch {
            // player may already be released
        }
    }
}

export function setFeedPlaybackActive(active: boolean): void {
    if (feedPlaybackActive === active) {
        if (!active) {
            pauseAllFeedPlayers();
        }
        return;
    }
    feedPlaybackActive = active;
    if (!active) {
        pauseAllFeedPlayers();
    }
    for (const listener of playbackActiveListeners) {
        listener(active);
    }
}
