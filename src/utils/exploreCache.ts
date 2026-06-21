/** Explore tab — warm cache so revisits feel instant. */
export const EXPLORE_STALE_MS = 5 * 60_000;
export const EXPLORE_GC_MS = 10 * 60_000;

/** First page size for tag video grid (3 columns × 6 rows). */
export const EXPLORE_FEED_PAGE_SIZE = 18;

/** Stop chasing empty pages after this many searchPosts calls. */
export const EXPLORE_MAX_EMPTY_FETCHES = 2;

/** Seed tag while trending topics load. */
export const EXPLORE_DEFAULT_TAG = 'flip';
