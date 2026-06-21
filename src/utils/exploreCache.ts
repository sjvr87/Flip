import type { FlipFeedPage } from '@/atproto/types';

import { Storage } from '@/utils/cache';

/** Explore tab — warm cache so revisits feel instant. */
export const EXPLORE_STALE_MS = 10 * 60_000;
export const EXPLORE_GC_MS = 20 * 60_000;

/** First page size for tag video grid (3 columns × 4 rows). */
export const EXPLORE_FEED_PAGE_SIZE = 12;

/** First paint — one searchPosts call only; pagination fetches one page at a time. */
export const EXPLORE_MAX_EMPTY_FETCHES = 1;

/** Seed tag for video grid until user picks a trending tag. */
export const EXPLORE_DEFAULT_TAG = 'flip';

export const EXPLORE_TAGS_LIMIT = 8;
export const EXPLORE_ACCOUNTS_LIMIT = 10;

const CACHE_PREFIX = 'explore.cache.';

export type ExploreTagCache = {
  id: number;
  name: string;
  count: number;
};

export type ExploreAccountCache = {
  id: string;
  name: string;
  avatar: string;
  username: string;
  bio: string;
  follower_count: number;
  post_count?: number;
};

type ExploreFeedCache = {
  pages: FlipFeedPage[];
  pageParams: (string | false | null)[];
};

function readJson<T>(key: string): T | undefined {
  const raw = Storage.getString(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    Storage.set(key, JSON.stringify(value));
  } catch {
    // Best-effort warm cache — never block Explore.
  }
}

export function readExploreTagsCache(): ExploreTagCache[] | undefined {
  const data = readJson<ExploreTagCache[]>(`${CACHE_PREFIX}tags`);
  return Array.isArray(data) && data.length > 0 ? data : undefined;
}

export function writeExploreTagsCache(tags: ExploreTagCache[]): void {
  writeJson(`${CACHE_PREFIX}tags`, tags);
}

export function readExploreAccountsCache(): ExploreAccountCache[] | undefined {
  const data = readJson<ExploreAccountCache[]>(`${CACHE_PREFIX}accounts`);
  return Array.isArray(data) && data.length > 0 ? data : undefined;
}

export function writeExploreAccountsCache(accounts: ExploreAccountCache[]): void {
  writeJson(`${CACHE_PREFIX}accounts`, accounts);
}

export function readExploreFeedCache(tag: string): ExploreFeedCache | undefined {
  const safeTag = tag.replace(/^#/, '').toLowerCase();
  const data = readJson<ExploreFeedCache>(`${CACHE_PREFIX}feed.${safeTag}`);
  if (!data?.pages?.length) return undefined;
  return data;
}

export function writeExploreFeedCache(tag: string, pages: FlipFeedPage[], pageParams: (string | false | null)[]): void {
  const safeTag = tag.replace(/^#/, '').toLowerCase();
  writeJson(`${CACHE_PREFIX}feed.${safeTag}`, { pages, pageParams });
}
