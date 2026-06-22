/** Tracks whether the home feed should decode video or warm HLS prefetch. */
let feedPlaybackActive = true;

export function isFeedPlaybackActive(): boolean {
    return feedPlaybackActive;
}

export function setFeedPlaybackActive(active: boolean): void {
    feedPlaybackActive = active;
}
