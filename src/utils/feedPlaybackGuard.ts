/** Tracks whether the home feed should decode video or warm HLS prefetch. */
let feedPlaybackActive = true;
/** Briefly false during Following/Local/For You switches so stale cells cannot recreate players. */
let feedPlaybackSuspended = false;
let playbackGeneration = 0;
let activeFeedPlayerId: string | null = null;

type PlayerPauseFn = () => void;
type PlayerReleaseFn = () => void;

type FeedPlayerRegistration = {
    id: string;
    pause: PlayerPauseFn;
    release: PlayerReleaseFn;
};

const registeredPlayers = new Set<FeedPlayerRegistration>();
const playbackActiveListeners = new Set<(active: boolean) => void>();

export function getFeedPlaybackGeneration(): number {
    return playbackGeneration;
}

function notifyPlaybackActive(): void {
    const active = isFeedPlaybackActive();
    for (const listener of playbackActiveListeners) {
        listener(active);
    }
}

function bumpPlaybackGeneration(): void {
    playbackGeneration += 1;
    activeFeedPlayerId = null;
}

export function isFeedPlaybackActive(): boolean {
    return feedPlaybackActive && !feedPlaybackSuspended;
}

export function subscribeFeedPlaybackActive(listener: (active: boolean) => void): () => void {
    playbackActiveListeners.add(listener);
    listener(isFeedPlaybackActive());
    return () => playbackActiveListeners.delete(listener);
}

/** Register pause + release handlers for a mounted feed player. */
export function registerFeedPlayer(
    id: string,
    pause: PlayerPauseFn,
    release: PlayerReleaseFn,
): () => void {
    const registration = { id, pause, release };
    registeredPlayers.add(registration);
    if (!isFeedPlaybackActive()) {
        try {
            pause();
        } catch {
            // player may already be released
        }
    }
    return () => {
        registeredPlayers.delete(registration);
        if (activeFeedPlayerId === id) {
            activeFeedPlayerId = null;
        }
    };
}

/** Only one feed slide may decode audio at a time. Pauses all other registered players first. */
export function claimFeedAudio(playerId: string): boolean {
    if (!isFeedPlaybackActive()) {
        return false;
    }
    if (activeFeedPlayerId === playerId) {
        return true;
    }
    for (const { id, pause } of registeredPlayers) {
        if (id !== playerId) {
            try {
                pause();
            } catch {
                // player may already be released
            }
        }
    }
    activeFeedPlayerId = playerId;
    return true;
}

export function releaseFeedAudio(playerId: string): void {
    if (activeFeedPlayerId === playerId) {
        activeFeedPlayerId = null;
    }
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
    bumpPlaybackGeneration();
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

/** Home feed segment changed (Following / Local / For You) — stop ghost audio immediately. */
export function onFeedTabChanged(): void {
    feedPlaybackSuspended = true;
    notifyPlaybackActive();
    bumpPlaybackGeneration();
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
    registeredPlayers.clear();

    requestAnimationFrame(() => {
        feedPlaybackSuspended = false;
        if (feedPlaybackActive) {
            notifyPlaybackActive();
        }
    });
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
    notifyPlaybackActive();
}
