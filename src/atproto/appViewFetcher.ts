/**
 * Pluggable feed-fetching interface for multi-AppView support.
 *
 * This module defines an abstract `AppViewFetcher` interface that any AT
 * Protocol AppView can implement to supply feed content to the Flip UI.
 * The default implementation delegates to the existing Bluesky-based logic
 * in `./feeds.ts`, so current behaviour is preserved.
 *
 * Phase 2 will introduce additional implementations that talk to other
 * AppViews (e.g. a native Flip PDS, other AT Protocol services).
 */

import type { AppViewEndpoint } from '@/constants/appViewRegistry';
import type { FlipFeedPage, FlipVideo } from './types';

/** Options passed to every feed-fetch call. */
export type FeedFetchParams = {
    cursor?: string | null;
    /** Bumped on pull-to-refresh to rotate sources / shuffle order. */
    refreshEpoch?: number;
};

/**
 * Abstract interface that an AppView must implement to supply feed content.
 *
 * Each method returns the same `FlipFeedPage` shape that the existing UI
 * expects, so the feed list component doesn't need to know which server
 * supplied the data.
 */
export interface AppViewFetcher {
    /** Which endpoint this fetcher talks to. */
    readonly endpoint: AppViewEndpoint;

    /** Fetch "Following" feed (posts from accounts the user follows). */
    fetchFollowing(params: FeedFetchParams): Promise<FlipFeedPage>;

    /** Fetch algorithmic "For You" / discovery feed. */
    fetchForYou(params: FeedFetchParams): Promise<FlipFeedPage>;

    /** Fetch trending / popular content. */
    fetchTrending(params: FeedFetchParams): Promise<FlipFeedPage>;

    /** Resolve a single post for full-screen viewing. */
    fetchPost(postId: string): Promise<FlipVideo | null>;
}

/**
 * FetcherRegistry — manages active AppView fetchers.
 *
 * In Phase 1 this holds a single Bluesky fetcher. Phase 2 will allow
 * registering multiple fetchers and merging their results.
 */
class FetcherRegistry {
    private fetchers: Map<string, AppViewFetcher> = new Map();

    register(fetcher: AppViewFetcher): void {
        this.fetchers.set(fetcher.endpoint.id, fetcher);
    }

    unregister(endpointId: string): void {
        this.fetchers.delete(endpointId);
    }

    get(endpointId: string): AppViewFetcher | undefined {
        return this.fetchers.get(endpointId);
    }

    getAll(): AppViewFetcher[] {
        return Array.from(this.fetchers.values());
    }

    /** Get the primary (first registered) fetcher. */
    getPrimary(): AppViewFetcher | undefined {
        return this.fetchers.values().next().value;
    }
}

/** Singleton registry instance. */
export const fetcherRegistry = new FetcherRegistry();
