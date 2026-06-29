/** Tracks whether the home feed should decode video or warm HLS prefetch. */
let feedPlaybackActive = true;
/** Briefly false during FYP/Following/Trending switches so stale cells cannot recreate players. */
let feedPlaybackSuspended = false;
/** Home tab visible in tab bar (single source of truth: tabs _layout pathname). */
let homeTabFocused = true;
/** App in foreground (single source of truth: feed index AppState). */
let appInForeground = true;
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
    return feedPlaybackActive && !feedPlaybackSuspended && homeTabFocused && appInForeground;
}

export function subscribeFeedPlaybackActive(listener: (active: boolean) => void): () => void {
    playbackActiveListeners.add(listener);
    listener(isFeedPlaybackActive());
    return () => playbackActiveListeners.delete(listener);
}

function applyPlaybackActiveState(): void {
    const shouldBeActive = homeTabFocused && appInForeground && !feedPlaybackSuspended;
    if (feedPlaybackActive === shouldBeActive) {
        return;
    }
    feedPlaybackActive = shouldBeActive;
    if (!shouldBeActive) {
        pauseAllFeedPlayers();
    }
    notifyPlaybackActive();
}

/** Tab bar Home visibility — called from (tabs)/_layout pathname only. */
export function setHomeTabFocused(focused: boolean): void {
    if (homeTabFocused === focused) {
        if (focused) {
            feedPlaybackSuspended = false;
            notifyPlaybackActive();
        }
        return;
    }
    homeTabFocused = focused;
    if (!focused) {
        activeFeedPlayerId = null;
        pauseAllFeedPlayers();
    } else {
        feedPlaybackSuspended = false;
    }
    applyPlaybackActiveState();
    notifyPlaybackActive();
}

/** App foreground — called from feed index AppState only. Release players on background. */
export function setAppInForeground(active: boolean): void {
    if (appInForeground === active) {
        return;
    }
    appInForeground = active;
    if (!active) {
        releaseAllFeedPlayers();
    }
    applyPlaybackActiveState();
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

/** Pause and release every registered player — app background only. */
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

/** Home feed segment changed (FYP / Following / Trending) — stop ghost audio immediately. */
export function onFeedTabChanged(): void {
    feedPlaybackSuspended = true;
    notifyPlaybackActive();
    bumpPlaybackGeneration();
    pauseAllFeedPlayers();
    requestAnimationFrame(() => {
        feedPlaybackSuspended = false;
        if (homeTabFocused && appInForeground) {
            notifyPlaybackActive();
        }
    });
}

/** @deprecated Use setHomeTabFocused(false) from tabs layout. */
export function stopFeedAudioOnTabLeave(): void {
    setHomeTabFocused(false);
}

/** @deprecated Use setHomeTabFocused(true) from tabs layout. */
export function resumeFeedPlaybackOnTabReturn(): void {
    setHomeTabFocused(true);
}

/** @deprecated Prefer setHomeTabFocused / setAppInForeground. */
export function setFeedPlaybackActive(active: boolean): void {
    if (active) {
        homeTabFocused = true;
        appInForeground = true;
        feedPlaybackSuspended = false;
    } else {
        activeFeedPlayerId = null;
        pauseAllFeedPlayers();
        feedPlaybackActive = false;
        notifyPlaybackActive();
        return;
    }
    applyPlaybackActiveState();
    notifyPlaybackActive();
}

export function isHomeTabPath(pathname: string): boolean {
    // Linking may briefly report "" before the initial tab route resolves.
    if (!pathname) {
        return true;
    }
    return (
        pathname === '/' ||
        pathname === '/index' ||
        pathname === '/(tabs)' ||
        pathname === '/(tabs)/index' ||
        pathname.endsWith('/index')
    );
}
