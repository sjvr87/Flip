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
const playbackGenerationListeners = new Set<(generation: number) => void>();

export function getFeedPlaybackGeneration(): number {
    return playbackGeneration;
}

export function getActiveFeedPlayerId(): string | null {
    return activeFeedPlayerId;
}

export function subscribePlaybackGeneration(listener: (generation: number) => void): () => void {
    playbackGenerationListeners.add(listener);
    listener(playbackGeneration);
    return () => playbackGenerationListeners.delete(listener);
}

function notifyPlaybackActive(): void {
    const active = isFeedPlaybackActive();
    for (const listener of playbackActiveListeners) {
        listener(active);
    }
}

function notifyPlaybackGeneration(): void {
    for (const listener of playbackGenerationListeners) {
        listener(playbackGeneration);
    }
}

function bumpPlaybackGeneration(): void {
    playbackGeneration += 1;
    activeFeedPlayerId = null;
    notifyPlaybackGeneration();
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

/** Only one feed slide may output audio. Pauses + mutes all other registered players first. */
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

/** Immediately pause + mute every registered expo-video player. */
export function pauseAllFeedPlayers(): void {
    activeFeedPlayerId = null;
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

/** Tab bar left Home — pause immediately (tabPress runs before blur/pathname). */
export function stopFeedAudioOnTabLeave(): void {
    activeFeedPlayerId = null;
    setFeedPlaybackActive(false);
    pauseAllFeedPlayers();
    releaseAllFeedPlayers();
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
