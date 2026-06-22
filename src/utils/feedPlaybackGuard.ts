/** Tracks whether the home feed should decode video or warm HLS prefetch. */
let feedPlaybackActive = true;

type PlayerPauseFn = () => void;
type PlayerReleaseFn = () => void;

type FeedPlayerRegistration = {
    pause: PlayerPauseFn;
    release: PlayerReleaseFn;
};

const registeredPlayers = new Set<FeedPlayerRegistration>();
const playbackActiveListeners = new Set<(active: boolean) => void>();

export function isFeedPlaybackActive(): boolean {
    return feedPlaybackActive;
}

export function subscribeFeedPlaybackActive(listener: (active: boolean) => void): () => void {
    playbackActiveListeners.add(listener);
    listener(feedPlaybackActive);
    return () => playbackActiveListeners.delete(listener);
}

/** Register pause + release handlers for a mounted feed player. */
export function registerFeedPlayer(
    pause: PlayerPauseFn,
    release: PlayerReleaseFn,
): () => void {
    const registration = { pause, release };
    registeredPlayers.add(registration);
    if (!feedPlaybackActive) {
        try {
            pause();
            release();
        } catch {
            // player may already be released
        }
    }
    return () => registeredPlayers.delete(registration);
}

/** Immediately pause every registered expo-video player. */
export function pauseAllFeedPlayers(): void {
    for (const { pause } of registeredPlayers) {
        try {
            pause();
        } catch {
            // player may already be released
        }
    }
}

/** Pause and release every registered player — tab blur / background only. */
export function releaseAllFeedPlayers(): void {
    for (const { pause, release } of registeredPlayers) {
        try {
            pause();
        } catch {
            // ignore
        }
        try {
            release();
        } catch {
            // ignore
        }
    }
}

export function setFeedPlaybackActive(active: boolean): void {
    if (feedPlaybackActive === active) {
        if (!active) {
            releaseAllFeedPlayers();
        }
        return;
    }
    feedPlaybackActive = active;
    if (!active) {
        releaseAllFeedPlayers();
    }
    for (const listener of playbackActiveListeners) {
        listener(active);
    }
}
