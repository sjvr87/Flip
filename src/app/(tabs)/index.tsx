import CommentsModal from '@/components/feed/CommentsModal';
import CaptionExpandModal from '@/components/feed/CaptionExpandModal';
import FeedEmptyState from '@/components/feed/FeedEmptyState';
import OtherModal from '@/components/feed/OtherModal';
import ShareModal from '@/components/feed/ShareModal';
import VideoPlayer from '@/components/feed/VideoPlayer';
import {
    feedFlatListWindowSize,
    feedInitialNumToRender,
    feedMaxToRenderPerBatch,
    feedPlayerPreloadDistance,
    feedPrefetchAhead,
} from '@/utils/androidVideoSafeMode';
import { useAuthStore } from '@/utils/authStore';
import {
    FEED_GC_MS,
    FEED_TABS,
    dedupeFeedVideos,
    type FeedInfiniteCache,
    type FeedTab,
    getFeedSoftRefreshMs,
    getFeedStaleMs,
    hardRefreshFeed,
    getCachedFeedInfiniteData,
    getCachedFeedVideos,
    markVideoSeenInSession,
    resetSessionSeen,
    softRefreshFeed,
    warmFeedTabMedia,
    warmFeedVideosInRange,
    warmFeedVideosNearIndex,
} from '@/utils/feedCache';
import {
    getFeedNetworkProfile,
    startFeedNetworkMonitoring,
    subscribeFeedNetworkProfile,
    type FeedNetworkProfile,
} from '@/utils/feedNetworkQuality';
import {
    isFeedPlaybackActive,
    onFeedTabChanged,
    prepareFeedTabHandoff,
    setAppInForeground,
    subscribeFeedPlaybackActive,
} from '@/utils/feedPlaybackGuard';
import { computeFeedVideoViewport, useFlipTabBarMetrics, getFeedVideoBandInsets } from '@/utils/tabBarLayout';
import { resolveFeedSnapIndex, isRigorousFeedSwipe } from '@/utils/feedScrollSnap';
import { feedInfiniteQueryOptions, feedQueryFn, feedVideosQueryKey } from '@/utils/feedQuery';
import { prefetchThumbnails } from '@/utils/thumbnailPrefetch';
import {
    cancelOffscreenPrefetch,
    prefetchVideoUrls,
    releaseAllVideoPrefetch,
} from '@/utils/videoPrefetch';
import { FeedScrollGestureRoot } from '@/utils/feedScrollGesture';
import {
    getConfiguration,
    invalidateFollowingDidsCache,
    recordImpression,
    videoBookmark,
    videoLike,
    videoRepost,
    videoUnbookmark,
    videoUnlike,
    videoUnrepost,
} from '@/atproto';
import type { FlipVideo } from '@/atproto/types';
import SearchEyeIcon from '@/components/icons/SearchEyeIcon';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router/react-navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    FlatList,
    InteractionManager,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    PixelRatio,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
/** Start loading next page when this many videos from the end (TikTok-style). */
const LOAD_MORE_THRESHOLD = 4;
/** Preload HLS for the next video only (network tier may disable entirely). */
const PREFETCH_AHEAD = feedPrefetchAhead;
/** Stop auto-pagination when this many consecutive pages dedupe to zero new videos. */
const MAX_EMPTY_DEDUPE_FETCHES = 8;
/** Exit infinite home spinner and show retry UI after this long. */
const FEED_LOADER_TIMEOUT_MS = 18_000;
/** Only mount expo-video players within this distance of the active slide. */
const PLAYER_PRELOAD_DISTANCE = feedPlayerPreloadDistance;

type FeedVideoCellProps = {
    item: FlipVideo;
    index: number;
    activeIndex: number;
    shouldPreload: boolean;
    feedHeight: number;
    videoTopInset: number;
    videoBottomReserved: number;
    bottomInset: number;
    tabBarHeight: number;
    feedOverlayBottom: number;
    actionRailBottom: number;
    screenFocused: boolean;
    feedPlaybackEnabled: boolean;
    commentsOpen: boolean;
    shareOpen: boolean;
    otherOpen: boolean;
    videoPlaybackRates: Record<string, number>;
    navigation: unknown;
    onLike: (videoId: string, liked: boolean) => void;
    onComment: (video: FlipVideo) => void;
    onCaptionExpand: (video: FlipVideo) => void;
    onShare: (video: FlipVideo) => void;
    onBookmark: (videoId: string, bookmarked: boolean) => void;
    onRepost: (videoId: string, reposted: boolean) => void;
    onOther: (video: FlipVideo) => void;
    onNavigate: () => void;
};

const FeedVideoCell = React.memo(function FeedVideoCell({
    item,
    index,
    activeIndex,
    shouldPreload,
    feedHeight,
    videoTopInset,
    videoBottomReserved,
    bottomInset,
    tabBarHeight,
    feedOverlayBottom,
    actionRailBottom,
    screenFocused,
    feedPlaybackEnabled,
    commentsOpen,
    shareOpen,
    otherOpen,
    videoPlaybackRates,
    navigation,
    onLike,
    onComment,
    onCaptionExpand,
    onShare,
    onBookmark,
    onRepost,
    onOther,
    onNavigate,
}: FeedVideoCellProps) {
    const isActive = index === activeIndex;

    return (
        <VideoPlayer
            item={item}
            isActive={isActive}
            shouldPreload={shouldPreload}
            feedHeight={feedHeight}
            videoTopInset={videoTopInset}
            videoBottomReserved={videoBottomReserved}
            onLike={onLike}
            onComment={onComment}
            onCaptionExpand={onCaptionExpand}
            onShare={onShare}
            onBookmark={onBookmark}
            onRepost={onRepost}
            onOther={onOther}
            bottomInset={bottomInset}
            commentsOpen={commentsOpen}
            shareOpen={shareOpen}
            otherOpen={otherOpen}
            screenFocused={screenFocused && feedPlaybackEnabled}
            videoPlaybackRates={videoPlaybackRates}
            navigation={navigation}
            onNavigate={onNavigate}
            tabBarHeight={tabBarHeight}
            overlayBottom={feedOverlayBottom}
            actionRailBottom={actionRailBottom}
        />
    );
});

const INITIAL_FEED_EPOCHS = Object.fromEntries(FEED_TABS.map((tab) => [tab, 0])) as Record<
    (typeof FEED_TABS)[number],
    number
>;

export default function LoopsFeed({ navigation }) {
    const { height: windowHeight } = useWindowDimensions();
    const feedHeight = PixelRatio.roundToNearestPixel(windowHeight);
    const insets = useSafeAreaInsets();
    const tabBarMetrics = useFlipTabBarMetrics();
    const feedVideoBand = useMemo(() => getFeedVideoBandInsets(), []);
    const feedVideoViewport = useMemo(
        () => computeFeedVideoViewport(windowHeight, insets.top, tabBarMetrics.feedVideoBottomReserved),
        [windowHeight, insets.top, tabBarMetrics.feedVideoBottomReserved],
    );
    const statusBarInset = feedVideoViewport.topInset;
    const authReady = useAuthStore((state) => state.authReady);
    const hideForYouFeed = useAuthStore((state) => state.hideForYouFeed);
    const defaultFeed = useAuthStore((state) => state.defaultFeed);
    const hasHydrated = useAuthStore((state) => state._hasHydrated);
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
    const viewerDid = useAuthStore((state) => state.user?.id);
    const feedQueryEnabled = hasHydrated && isLoggedIn && authReady;
    const [feedEpochs, setFeedEpochs] = useState(INITIAL_FEED_EPOCHS);
    const normalizedDefault =
        defaultFeed === 'local' ? 'trending' : defaultFeed;
    const [activeTab, setActiveTab] = useState<FeedTab>(normalizedDefault as FeedTab);
    const feedEpoch = feedEpochs[activeTab] ?? 0;
    const feedEpochRef = useRef(feedEpoch);
    feedEpochRef.current = feedEpoch;
    const feedEpochsRef = useRef(feedEpochs);
    feedEpochsRef.current = feedEpochs;
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dedupeExhausted, setDedupeExhausted] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [showComments, setShowComments] = useState(false);
    const [showCaptionExpand, setShowCaptionExpand] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [videoPlaybackRates, setVideoPlaybackRates] = useState({});
    const [screenFocused, setScreenFocused] = useState(true);
    const [appActive, setAppActive] = useState(AppState.currentState === 'active');
    const [guardPlaybackActive, setGuardPlaybackActive] = useState(isFeedPlaybackActive);
    const [loaderTimedOut, setLoaderTimedOut] = useState(false);
    const [manualRefreshing, setManualRefreshing] = useState(false);
    const [networkProfile, setNetworkProfile] = useState<FeedNetworkProfile>(() =>
        getFeedNetworkProfile(),
    );
    const feedPlaybackEnabled = screenFocused && appActive && guardPlaybackActive;

    useEffect(() => subscribeFeedPlaybackActive(setGuardPlaybackActive), []);
    const flatListRef = useRef(null);
    const isSnappingRef = useRef(false);
    const rigorousSnapRef = useRef(false);
    const scrollStartIndexRef = useRef(0);
    const scrollEndDragVelocityRef = useRef(0);
    const tabScrollIndexRef = useRef<Record<FeedTab, number>>({
        following: 0,
        forYou: 0,
        trending: 0,
    });
    const router = useRouter();
    const queryClient = useQueryClient();
    const currentVideoRef = useRef(null);
    const watchStartTimeRef = useRef(null);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    });

    const { data: appConfig, isLoading: isConfigLoading } = useQuery({
        queryKey: ['appConfig'],
        queryFn: getConfiguration,
        enabled: feedQueryEnabled,
    });

    const forYouEnabled = appConfig?.fyf === true && !hideForYouFeed;

    useEffect(() => {
        if (!feedQueryEnabled) {
            return;
        }
        const epochs = feedEpochsRef.current;
        const prefetchTab = (tab: (typeof FEED_TABS)[number]) => {
            if (tab === 'forYou' && !forYouEnabled) {
                return;
            }
            const epoch = epochs[tab] ?? 0;
            warmFeedTabMedia(queryClient, tab, epoch, viewerDid, {
                prefetchThumbnails,
                prefetchVideoUrls,
            });
            void queryClient
                .prefetchInfiniteQuery({
                    ...feedInfiniteQueryOptions(tab, epoch, viewerDid, getFeedStaleMs(tab)),
                })
                .then(() => {
                    warmFeedTabMedia(queryClient, tab, epoch, viewerDid, {
                        prefetchThumbnails,
                        prefetchVideoUrls,
                    });
                })
                .catch((error) => {
                    console.warn('[feed] background prefetch failed:', tab, error);
                });
        };

        // Defer sibling-tab prefetch until the active feed has painted (avoids startup reload pressure).
        const task = InteractionManager.runAfterInteractions(() => {
            for (const tab of FEED_TABS) {
                if (tab !== activeTabRef.current) {
                    prefetchTab(tab);
                }
            }
        });
        return () => task.cancel();
    }, [feedQueryEnabled, forYouEnabled, queryClient, viewerDid]);

    const recordVideoImpression = useCallback(
        async (video, duration) => {
            if (activeTab !== 'forYou' || !video) {
                return;
            }

            if (duration < 1) {
                return;
            }

            const videoDuration = video.media.duration || 0;
            const completed = videoDuration > 0 && duration >= videoDuration * 0.9;

            await recordImpression(video.id, duration, completed);
        },
        [activeTab],
    );

    const {
        data,
        error: queryError,
        fetchNextPage,
        hasNextPage,
        isError,
        isFetchingNextPage,
        isLoading,
        isFetching,
        isRefetching,
    } = useInfiniteQuery({
        ...feedInfiniteQueryOptions(activeTab, feedEpoch, viewerDid, getFeedStaleMs(activeTab)),
        gcTime: FEED_GC_MS,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        placeholderData: (previousData) =>
            previousData ??
            getCachedFeedInfiniteData(queryClient, activeTab, feedEpoch, viewerDid),
        maxPages: 25,
        enabled: feedQueryEnabled,
    });

    const videoLikeMutation = useMutation({
        mutationFn: async (data) => {
            const dir = data.type;

            if (dir == 'like') {
                return await videoLike(data.id);
            }
            if (dir == 'unlike') {
                return await videoUnlike(data.id);
            }
        },
        onSuccess: (res) => {},
        onError: (error) => {},
    });

    const videoBookmarkMutation = useMutation({
        mutationFn: async (data) => {
            const dir = data.type;

            if (dir == 'bookmark') {
                return await videoBookmark(data.id);
            }
            if (dir == 'unbookmark') {
                return await videoUnbookmark(data.id);
            }
        },
        onSuccess: (res) => {},
        onError: (error) => {},
    });

    const videoRepostMutation = useMutation({
        mutationFn: async (data) => {
            if (data.type === 'repost') {
                return await videoRepost(data.id);
            }
            if (data.type === 'unrepost') {
                return await videoUnrepost(data.id);
            }
        },
        onSuccess: () => {},
        onError: (error) => {
            console.warn('[feed] repost failed:', error);
        },
    });

    const rawVideos = useMemo(() => {
        if (data?.pages?.length) {
            return data.pages.flatMap((page) => page.data);
        }
        const cached = getCachedFeedInfiniteData(queryClient, activeTab, feedEpoch, viewerDid);
        return cached?.pages?.flatMap((page) => page.data) ?? [];
    }, [data?.pages, queryClient, activeTab, feedEpoch, viewerDid]);
    const videos = useMemo(() => dedupeFeedVideos(rawVideos, activeTab), [rawVideos, activeTab]);
    const feedTrulyEmpty = !isLoading && rawVideos.length === 0;
    const feedExhausted = !isLoading && !isFetchingNextPage && !hasNextPage && videos.length > 0;
    const feedDedupeExhausted =
        !isLoading &&
        !isFetchingNextPage &&
        hasNextPage &&
        rawVideos.length > 0 &&
        videos.length === 0 &&
        dedupeExhausted;
    const feedCaughtUp =
        !isLoading &&
        !isFetching &&
        !isFetchingNextPage &&
        rawVideos.length > 0 &&
        videos.length === 0 &&
        (!hasNextPage || feedDedupeExhausted);
    const feedError = isError
        ? queryError instanceof Error
            ? queryError.message
            : 'Could not load the feed. Pull down to try again.'
        : (data?.pages?.[0]?.meta?.error ?? null);
    const videosRef = useRef(videos);
    videosRef.current = videos;
    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;

    const hasNextPageRef = useRef(hasNextPage);
    hasNextPageRef.current = hasNextPage;
    const isFetchingNextPageRef = useRef(isFetchingNextPage);
    isFetchingNextPageRef.current = isFetchingNextPage;
    const fetchNextPageRef = useRef(fetchNextPage);
    fetchNextPageRef.current = fetchNextPage;
    const emptyDedupeFetchCountRef = useRef(0);
    const lastRawCountRef = useRef(0);
    const lastVideosCountRef = useRef(0);
    const stagnantPageFetchCountRef = useRef(0);
    const autoFetchInFlightRef = useRef(false);
    const dedupeExhaustedRef = useRef(false);

    useEffect(() => {
        emptyDedupeFetchCountRef.current = 0;
        lastRawCountRef.current = 0;
        lastVideosCountRef.current = 0;
        stagnantPageFetchCountRef.current = 0;
        autoFetchInFlightRef.current = false;
        dedupeExhaustedRef.current = false;
        setDedupeExhausted(false);
    }, [activeTab, feedEpoch]);

    const maybeLoadMoreVideos = useCallback((visibleIndex: number) => {
        const total = videosRef.current.length;
        if (total === 0 || visibleIndex < total - LOAD_MORE_THRESHOLD) {
            return;
        }
        if (hasNextPageRef.current && !isFetchingNextPageRef.current) {
            void fetchNextPageRef.current();
        }
    }, []);

    const recordVideoImpressionRef = useRef(recordVideoImpression);
    recordVideoImpressionRef.current = recordVideoImpression;

    const bumpFeedEpoch = useCallback((tab: string) => {
        setFeedEpochs((prev) => ({
            ...prev,
            [tab]: (prev[tab as keyof typeof prev] ?? 0) + 1,
        }));
        resetSessionSeen(tab);
    }, []);

    const refreshFeedIfStale = useCallback(
        (tab: string, epoch: number) => {
            const state = queryClient.getQueryState(
                feedVideosQueryKey(tab as FeedTab, epoch, viewerDid),
            );
            if (!state?.data || state.fetchStatus === 'fetching') {
                return;
            }
            const age = Date.now() - (state.dataUpdatedAt ?? 0);
            const softMs = getFeedSoftRefreshMs(tab);
            // Soft refresh page 0 only when at the top — avoids resetting mid-scroll feed.
            if (age >= softMs && currentIndexRef.current === 0) {
                softRefreshFeed(queryClient, tab);
            }
        },
        [queryClient, viewerDid],
    );

    const warmFeedTab = useCallback(
        (tab: FeedTab) => {
            if (tab === activeTabRef.current) {
                return;
            }
            if (tab === 'forYou' && !forYouEnabled) {
                return;
            }
            const epoch = feedEpochsRef.current[tab] ?? 0;
            warmFeedTabMedia(queryClient, tab, epoch, viewerDid, {
                prefetchThumbnails,
                prefetchVideoUrls,
            });
            void queryClient
                .prefetchInfiniteQuery({
                    ...feedInfiniteQueryOptions(tab, epoch, viewerDid, getFeedStaleMs(tab)),
                })
                .then(() => {
                    warmFeedTabMedia(queryClient, tab, epoch, viewerDid, {
                        prefetchThumbnails,
                        prefetchVideoUrls,
                    });
                })
                .catch((error) => {
                    console.warn('[feed] tab prefetch failed:', tab, error);
                });
        },
        [forYouEnabled, queryClient, viewerDid],
    );

    const switchFeedTab = useCallback(
        (tab: FeedTab) => {
            if (tab === activeTabRef.current) {
                return;
            }

            const prevTab = activeTabRef.current;
            tabScrollIndexRef.current[prevTab] = currentIndexRef.current;

            warmFeedTabMedia(queryClient, tab, feedEpochsRef.current[tab] ?? 0, viewerDid, {
                prefetchThumbnails,
                prefetchVideoUrls,
            });

            prepareFeedTabHandoff();

            if (currentVideoRef.current && watchStartTimeRef.current) {
                const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
                recordVideoImpressionRef.current(currentVideoRef.current, watchDuration);
            }
            currentVideoRef.current = null;
            watchStartTimeRef.current = null;

            const restoredIndex = tabScrollIndexRef.current[tab] ?? 0;
            setActiveTab(tab);
            setCurrentIndex(restoredIndex);

            requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({
                    offset: restoredIndex * feedHeight,
                    animated: false,
                });
                refreshFeedIfStale(tab, feedEpochsRef.current[tab] ?? 0);
            });
        },
        [queryClient, refreshFeedIfStale, viewerDid, feedHeight],
    );

    useEffect(() => {
        if (!isConfigLoading && appConfig) {
            if (!forYouEnabled && activeTab === 'forYou') {
                switchFeedTab('trending');
            }
        }
    }, [isConfigLoading, appConfig, forYouEnabled, activeTab, switchFeedTab]);

    const onRefresh = useCallback(() => {
        const tab = activeTabRef.current;
        setManualRefreshing(true);
        onFeedTabChanged();
        releaseAllVideoPrefetch();
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        setCurrentIndex(0);
        emptyDedupeFetchCountRef.current = 0;
        lastRawCountRef.current = 0;
        lastVideosCountRef.current = 0;
        stagnantPageFetchCountRef.current = 0;
        autoFetchInFlightRef.current = false;
        dedupeExhaustedRef.current = false;
        setDedupeExhausted(false);
        bumpFeedEpoch(tab);
        invalidateFollowingDidsCache();
        queryClient.invalidateQueries({ queryKey: ['followingDids'] });
        hardRefreshFeed(queryClient, tab);
    }, [bumpFeedEpoch, queryClient]);

    useEffect(() => {
        if (!manualRefreshing) {
            return;
        }
        if (!isFetching && !isRefetching) {
            setManualRefreshing(false);
        }
    }, [manualRefreshing, isFetching, isRefetching]);

    useEffect(() => {
        const stopNetwork = startFeedNetworkMonitoring();
        const unsubNetwork = subscribeFeedNetworkProfile(setNetworkProfile);
        return () => {
            stopNetwork();
            unsubNetwork();
        };
    }, []);

    useEffect(() => {
        if (!feedPlaybackEnabled) {
            releaseAllVideoPrefetch();
        }
    }, [feedPlaybackEnabled]);

    useFocusEffect(
        useCallback(() => {
            setScreenFocused(true);
            refreshFeedIfStale(activeTabRef.current, feedEpochRef.current);

            return () => {
                setScreenFocused(false);
                releaseAllVideoPrefetch();
                if (currentVideoRef.current && watchStartTimeRef.current) {
                    const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
                    recordVideoImpressionRef.current(currentVideoRef.current, watchDuration);
                }
            };
        }, [refreshFeedIfStale]),
    );

    useEffect(() => {
        setAppInForeground(AppState.currentState === 'active');
        const subscription = AppState.addEventListener('change', (nextState) => {
            const active = nextState === 'active';
            setAppActive(active);
            setAppInForeground(active);
            if (!active) {
                releaseAllVideoPrefetch();
            }
            if (active) {
                for (const tab of FEED_TABS) {
                    const epoch = feedEpochsRef.current[tab] ?? 0;
                    refreshFeedIfStale(tab, epoch);
                }
            }
        });
        return () => subscription.remove();
    }, [refreshFeedIfStale]);

    useEffect(() => {
        if (videos.length > 0) {
            emptyDedupeFetchCountRef.current = 0;
            lastRawCountRef.current = rawVideos.length;
            autoFetchInFlightRef.current = false;
            dedupeExhaustedRef.current = false;
            setDedupeExhausted(false);
            return;
        }

        if (
            isLoading ||
            isFetchingNextPage ||
            !hasNextPage ||
            rawVideos.length === 0 ||
            dedupeExhaustedRef.current ||
            autoFetchInFlightRef.current
        ) {
            return;
        }

        const nearEnd =
            videosRef.current.length === 0 ||
            currentIndex >= videosRef.current.length - LOAD_MORE_THRESHOLD;
        if (!nearEnd) {
            return;
        }

        if (rawVideos.length === lastRawCountRef.current) {
            emptyDedupeFetchCountRef.current += 1;
        } else {
            emptyDedupeFetchCountRef.current = 0;
            lastRawCountRef.current = rawVideos.length;
        }

        if (emptyDedupeFetchCountRef.current >= MAX_EMPTY_DEDUPE_FETCHES) {
            dedupeExhaustedRef.current = true;
            setDedupeExhausted(true);
            return;
        }

        autoFetchInFlightRef.current = true;
        void fetchNextPageRef.current().finally(() => {
            autoFetchInFlightRef.current = false;
        });
    }, [
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        videos.length,
        rawVideos.length,
        currentIndex,
        feedEpoch,
    ]);

    useEffect(() => {
        if (isLoading || isFetchingNextPage) {
            return;
        }

        const prevVideos = lastVideosCountRef.current;
        const prevRaw = lastRawCountRef.current;

        if (rawVideos.length > prevRaw && videos.length === prevVideos && videos.length > 0) {
            stagnantPageFetchCountRef.current += 1;
            if (
                stagnantPageFetchCountRef.current <= 6 &&
                hasNextPage &&
                !autoFetchInFlightRef.current
            ) {
                autoFetchInFlightRef.current = true;
                void fetchNextPage().finally(() => {
                    autoFetchInFlightRef.current = false;
                });
            } else if (stagnantPageFetchCountRef.current > 6) {
                dedupeExhaustedRef.current = true;
                setDedupeExhausted(true);
            }
        } else if (videos.length > prevVideos) {
            stagnantPageFetchCountRef.current = 0;
        }

        lastVideosCountRef.current = videos.length;
        lastRawCountRef.current = rawVideos.length;
    }, [
        videos.length,
        rawVideos.length,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    ]);

    const videosWithEnd = React.useMemo(() => {
        if (feedTrulyEmpty) {
            return [{ id: 'feed-empty', isEmptyMarker: true }];
        }
        if (feedCaughtUp) {
            return [{ id: 'feed-end', isEndMarker: true }];
        }
        if (feedExhausted) {
            return [...videos, { id: 'feed-end', isEndMarker: true }];
        }
        return videos;
    }, [videos, feedTrulyEmpty, feedCaughtUp, feedExhausted]);

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const newIndex = viewableItems[0].index || 0;
            const newVideo = videosRef.current[newIndex];
            const prevVideo = currentVideoRef.current;
            const prevWatchStart = watchStartTimeRef.current;

            maybeLoadMoreVideos(newIndex);

            setCurrentIndex(newIndex);
            tabScrollIndexRef.current[activeTabRef.current] = newIndex;
            currentVideoRef.current = newVideo;
            watchStartTimeRef.current = Date.now();

            if (newVideo) {
                markVideoSeenInSession(activeTabRef.current, newVideo);
                warmFeedVideosNearIndex(videosRef.current, newIndex, prefetchThumbnails);
            }

            if (prevVideo && prevWatchStart) {
                InteractionManager.runAfterInteractions(() => {
                    const watchDuration = (Date.now() - prevWatchStart) / 1000;
                    recordVideoImpressionRef.current(prevVideo, watchDuration);
                });
            }
        }
    }).current;

    useEffect(() => {
        return () => {
            if (currentVideoRef.current && watchStartTimeRef.current) {
                const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
                recordVideoImpressionRef.current(currentVideoRef.current, watchDuration);
            }
        };
    }, [activeTab]);

    useEffect(() => {
        if (!feedPlaybackEnabled || videos.length === 0) {
            return;
        }

        const preloadDistance = Math.min(
            PLAYER_PRELOAD_DISTANCE,
            networkProfile.playerPreloadDistance,
        );
        const prefetchAhead = Math.min(PREFETCH_AHEAD, networkProfile.prefetchAhead);

        const keepUrls = new Set<string>();
        for (let offset = -preloadDistance; offset <= prefetchAhead; offset += 1) {
            const url = videos[currentIndex + offset]?.media?.src_url;
            if (url) {
                keepUrls.add(url);
            }
        }
        cancelOffscreenPrefetch(keepUrls);

        warmFeedVideosNearIndex(videos, currentIndex, prefetchThumbnails);

        if (prefetchAhead > 0) {
            const nextUrl = videos[currentIndex + 1]?.media?.src_url;
            prefetchVideoUrls(nextUrl ? [nextUrl] : []);
        }

        const thumbUrls: string[] = [];
        for (let i = -1; i <= 2; i += 1) {
            const video = videos[currentIndex + i];
            if (video?.media?.thumbnail) {
                thumbUrls.push(video.media.thumbnail);
            }
            if (video?.account?.avatar) {
                thumbUrls.push(video.account.avatar);
            }
        }
        prefetchThumbnails(thumbUrls);
    }, [
        currentIndex,
        videos,
        feedPlaybackEnabled,
        networkProfile.tier,
        networkProfile.prefetchAhead,
        networkProfile.playerPreloadDistance,
    ]);

    useEffect(() => {
        if (!feedPlaybackEnabled || videos.length === 0 || currentIndex !== 0) {
            return;
        }
        const first = videos[0];
        if (first?.media?.thumbnail) {
            prefetchThumbnails([first.media.thumbnail, first.account?.avatar]);
        }
        const prefetchAhead = Math.min(PREFETCH_AHEAD, networkProfile.prefetchAhead);
        const urls: string[] = [];
        if (first?.media?.src_url) {
            urls.push(first.media.src_url);
        }
        if (prefetchAhead > 0 && videos[1]?.media?.src_url) {
            urls.push(videos[1].media.src_url);
        }
        prefetchVideoUrls(urls);
    }, [
        activeTab,
        videos,
        feedPlaybackEnabled,
        networkProfile.tier,
        networkProfile.prefetchAhead,
        currentIndex,
    ]);

    const handleLike = useCallback(
        (videoId: string, liked: boolean) => {
            const dir = liked ? 'like' : 'unlike';
            videoLikeMutation.mutate({ type: dir, id: videoId });
        },
        [videoLikeMutation],
    );

    const handleBookmark = useCallback(
        (videoId: string, bookmarked: boolean) => {
            const dir = bookmarked ? 'bookmark' : 'unbookmark';
            videoBookmarkMutation.mutate({ type: dir, id: videoId });
        },
        [videoBookmarkMutation],
    );

    const handleRepost = useCallback(
        (videoId: string, reposted: boolean) => {
            const dir = reposted ? 'repost' : 'unrepost';
            videoRepostMutation.mutate({ type: dir, id: videoId });
        },
        [videoRepostMutation],
    );

    const handleComment = useCallback((video: FlipVideo) => {
        setSelectedVideo(video);
        setShowComments(true);
    }, []);

    const handleCaptionExpand = useCallback((video: FlipVideo) => {
        setSelectedVideo(video);
        setShowCaptionExpand(true);
    }, []);

    const handleShare = useCallback((video: FlipVideo) => {
        setSelectedVideo(video);
        setShowShare(true);
    }, []);

    const handleOther = useCallback((video: FlipVideo) => {
        setSelectedVideo(video);
        setShowOther(true);
    }, []);

    const handlePlaybackSpeedChange = (speed) => {
        if (selectedVideo) {
            setVideoPlaybackRates((prev) => ({
                ...prev,
                [selectedVideo.id]: speed,
            }));
        }
    };

    const handleNavigate = useCallback(() => {
        setShowComments(false);
        setShowCaptionExpand(false);
        setShowShare(false);
        setShowOther(false);
    }, []);

    const renderItem = useCallback(
        ({ item, index }) => {
            const cell = (() => {
                if (item.isEmptyMarker) {
                    return (
                        <FeedEmptyState
                            tab={activeTab}
                            onRefresh={onRefresh}
                            error={feedError}
                            itemHeight={feedHeight}
                        />
                    );
                }

                if (item.isEndMarker) {
                    const endTab =
                        activeTab === 'forYou'
                            ? 'forYou-end'
                            : activeTab === 'trending'
                              ? 'trending-end'
                              : 'following-end';
                    return (
                        <FeedEmptyState
                            tab={endTab}
                            onRefresh={onRefresh}
                            itemHeight={feedHeight}
                        />
                    );
                }

                const shouldPreloadPlayer =
                    feedPlaybackEnabled &&
                    (index === currentIndex ||
                        Math.abs(index - currentIndex) <= PLAYER_PRELOAD_DISTANCE);

                return (
                    <FeedVideoCell
                        item={item}
                        index={index}
                        activeIndex={currentIndex}
                        shouldPreload={shouldPreloadPlayer}
                        feedHeight={feedHeight}
                        videoTopInset={feedVideoBand.top}
                        videoBottomReserved={feedVideoBand.bottom}
                        onLike={handleLike}
                        onComment={handleComment}
                        onCaptionExpand={handleCaptionExpand}
                        onShare={handleShare}
                        onBookmark={handleBookmark}
                        onRepost={handleRepost}
                        onOther={handleOther}
                        bottomInset={tabBarMetrics.bottomInset}
                        commentsOpen={showComments && selectedVideo?.id === item.id}
                        shareOpen={showShare && selectedVideo?.id === item.id}
                        otherOpen={showOther && selectedVideo?.id === item.id}
                        screenFocused={screenFocused}
                        feedPlaybackEnabled={feedPlaybackEnabled}
                        videoPlaybackRates={videoPlaybackRates}
                        navigation={navigation}
                        onNavigate={handleNavigate}
                        tabBarHeight={tabBarMetrics.contentHeight}
                        feedOverlayBottom={tabBarMetrics.feedOverlayBottom}
                        actionRailBottom={tabBarMetrics.actionRailBottom}
                    />
                );
            })();

            return <View style={{ height: feedHeight, overflow: 'hidden', backgroundColor: '#000' }}>{cell}</View>;
        },
        [
            activeTab,
            currentIndex,
            feedError,
            feedHeight,
            feedVideoBand.bottom,
            feedVideoBand.top,
            onRefresh,
            tabBarMetrics.actionRailBottom,
            tabBarMetrics.bottomInset,
            tabBarMetrics.contentHeight,
            tabBarMetrics.feedOverlayBottom,
            handleLike,
            handleComment,
            handleCaptionExpand,
            handleShare,
            handleBookmark,
            handleRepost,
            handleOther,
            handleNavigate,
            showComments,
            showShare,
            showOther,
            selectedVideo,
            screenFocused,
            feedPlaybackEnabled,
            videoPlaybackRates,
            navigation,
        ],
    );

    const hasFeedData = (data?.pages?.length ?? 0) > 0;
    const cachedFeedData = getCachedFeedVideos(
        queryClient,
        activeTab,
        feedEpoch,
        viewerDid,
    );
    const showInitialLoader =
        cachedFeedData.length === 0 &&
        (!feedQueryEnabled || (isLoading && !hasFeedData));

    useEffect(() => {
        if (!showInitialLoader) {
            setLoaderTimedOut(false);
            return;
        }
        const timer = setTimeout(() => {
            console.warn('[feed] initial loader timed out — showing retry UI');
            setLoaderTimedOut(true);
        }, FEED_LOADER_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [showInitialLoader, activeTab, feedEpoch]);

    const showBlockingLoader = showInitialLoader && !loaderTimedOut && !feedError;

    const loaderHint = !hasHydrated
        ? 'Starting Flip…'
        : !authReady
          ? 'Restoring your session…'
          : !isLoggedIn
            ? 'Sign in to load your feed'
            : 'Loading videos…';

    const handleEndReached = useCallback(() => {
        maybeLoadMoreVideos(videosRef.current.length - 1);
    }, [maybeLoadMoreVideos]);

    const snapFeedFromScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>, animated = true) => {
            const { contentOffset, velocity } = event.nativeEvent;
            const target = resolveFeedSnapIndex(
                contentOffset.y,
                feedHeight,
                velocity?.y,
                videosWithEnd.length,
                scrollStartIndexRef.current,
                scrollEndDragVelocityRef.current,
            );
            const targetOffset = target * feedHeight;
            const start = scrollStartIndexRef.current;

            warmFeedVideosNearIndex(videosRef.current, target, prefetchThumbnails);
            if (Math.abs(target - start) > 1) {
                warmFeedVideosInRange(videosRef.current, start, target, prefetchThumbnails);
            }

            if (Math.abs(contentOffset.y - targetOffset) <= 1) {
                isSnappingRef.current = false;
                return;
            }

            isSnappingRef.current = true;
            flatListRef.current?.scrollToOffset({
                offset: targetOffset,
                animated,
            });
        },
        [feedHeight, videosWithEnd.length],
    );

    const handleScrollBeginDrag = useCallback(() => {
        scrollStartIndexRef.current = currentIndexRef.current;
        scrollEndDragVelocityRef.current = 0;
        isSnappingRef.current = false;
        rigorousSnapRef.current = false;
    }, []);

    const handleScrollEndDrag = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentOffset, velocity } = event.nativeEvent;
            const velocityY = velocity?.y ?? 0;
            scrollEndDragVelocityRef.current = velocityY;

            if (
                isRigorousFeedSwipe(
                    contentOffset.y,
                    feedHeight,
                    velocityY,
                    scrollStartIndexRef.current,
                )
            ) {
                const target = resolveFeedSnapIndex(
                    contentOffset.y,
                    feedHeight,
                    velocityY,
                    videosWithEnd.length,
                    scrollStartIndexRef.current,
                    velocityY,
                );
                const dest = videosWithEnd[target];
                if (dest?.media?.thumbnail) {
                    prefetchThumbnails([dest.media.thumbnail]);
                }
                warmFeedVideosInRange(
                    videosRef.current,
                    scrollStartIndexRef.current,
                    target,
                    prefetchThumbnails,
                );
                rigorousSnapRef.current = true;
                snapFeedFromScroll(event, false);
                return;
            }

            // Slow release with no momentum — lock to exactly one video (or stay put).
            if (Math.abs(velocityY) < 0.35) {
                snapFeedFromScroll(event, false);
            }
        },
        [feedHeight, snapFeedFromScroll, videosWithEnd],
    );

    const handleMomentumScrollEnd = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (rigorousSnapRef.current) {
                rigorousSnapRef.current = false;
                scrollEndDragVelocityRef.current = 0;
                return;
            }
            snapFeedFromScroll(event, false);
            scrollEndDragVelocityRef.current = 0;
        },
        [snapFeedFromScroll],
    );

    const getItemLayout = useCallback(
        (data, index) => ({
            length: feedHeight,
            offset: feedHeight * index,
            index,
        }),
        [feedHeight],
    );

    const refreshing = manualRefreshing && (isRefetching || isFetching) && !isFetchingNextPage;

    const feedHeader = (
        <View style={[styles.header, { top: statusBarInset }]}>
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    accessibilityRole="tab"
                    accessibilityLabel="Following"
                    accessibilityState={{
                        selected: activeTab === 'following',
                    }}
                    style={[styles.tab, activeTab === 'following' && styles.activeTab]}
                    onPressIn={() => warmFeedTab('following')}
                    onPress={() => switchFeedTab('following')}>
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'following' && styles.activeTabText,
                        ]}>
                        Following
                    </Text>
                </TouchableOpacity>
                {forYouEnabled && (
                    <TouchableOpacity
                        accessibilityRole="tab"
                        accessibilityLabel="FYP"
                        accessibilityState={{
                            selected: activeTab === 'forYou',
                        }}
                        style={[styles.tab, activeTab === 'forYou' && styles.activeTab]}
                        onPressIn={() => warmFeedTab('forYou')}
                        onPress={() => switchFeedTab('forYou')}>
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'forYou' && styles.activeTabText,
                            ]}>
                            FYP
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    accessibilityRole="tab"
                    accessibilityLabel="Trending"
                    accessibilityState={{
                        selected: activeTab === 'trending',
                    }}
                    style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
                    onPressIn={() => warmFeedTab('trending')}
                    onPress={() => switchFeedTab('trending')}>
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'trending' && styles.activeTabText,
                        ]}>
                        Trending
                    </Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                accessibilityLabel="Search"
                accessibilityRole="button"
                style={styles.searchButton}
                onPress={() => router.push('/private/search')}>
                <SearchEyeIcon size={31} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="light" backgroundColor="#000" translucent={Platform.OS === 'android'} />
            <View
                pointerEvents="none"
                style={[styles.statusBarBand, { height: statusBarInset }]}
            />
            {feedHeader}

            {showBlockingLoader ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loaderHint}>{loaderHint}</Text>
                    {!feedQueryEnabled && !isLoggedIn && authReady ? (
                        <TouchableOpacity
                            style={styles.loaderRetryButton}
                            onPress={() => router.push('/sign-in')}>
                            <Text style={styles.loaderRetryText}>Sign in</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.loaderRetryButton} onPress={onRefresh}>
                            <Text style={styles.loaderRetryText}>Retry</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : loaderTimedOut || feedError ? (
                <FeedEmptyState
                    tab={activeTab}
                    onRefresh={onRefresh}
                    error={
                        feedError ||
                        (loaderTimedOut
                            ? 'Feed is taking too long. Tap retry or pull down.'
                            : null)
                    }
                    itemHeight={feedHeight}
                />
            ) : (
                <FeedScrollGestureRoot>
                    <FlatList
                    ref={flatListRef}
                    style={styles.feedList}
                    data={videosWithEnd}
                    extraData={currentIndex}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => item.id ?? `feed-item-${index}`}
                    pagingEnabled
                    showsVerticalScrollIndicator={false}
                    decelerationRate="fast"
                    snapToInterval={feedHeight}
                    snapToAlignment="start"
                    disableIntervalMomentum
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onScrollEndDrag={handleScrollEndDrag}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    scrollEventThrottle={16}
                    overScrollMode="never"
                    viewabilityConfig={viewabilityConfig.current}
                    onViewableItemsChanged={onViewableItemsChanged}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    getItemLayout={getItemLayout}
                    removeClippedSubviews={false}
                    maxToRenderPerBatch={feedMaxToRenderPerBatch}
                    windowSize={feedFlatListWindowSize}
                    initialNumToRender={feedInitialNumToRender}
                    updateCellsBatchingPeriod={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            progressViewOffset={statusBarInset + 40}
                        />
                    }
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <View style={[styles.footer, { height: feedHeight }]}>
                                <ActivityIndicator size="large" color="#fff" />
                            </View>
                        ) : null
                    }
                    />
                </FeedScrollGestureRoot>
            )}

            <CommentsModal
                visible={showComments}
                item={selectedVideo}
                onClose={() => setShowComments(false)}
                navigation={navigation}
                onNavigate={handleNavigate}
                onCommentCountChange={(delta) => {
                    setSelectedVideo((prev) =>
                        prev
                            ? { ...prev, comments: Math.max(0, (prev.comments ?? 0) + delta) }
                            : prev,
                    );
                }}
            />

            <CaptionExpandModal
                visible={showCaptionExpand}
                item={selectedVideo}
                onClose={() => setShowCaptionExpand(false)}
                onNavigate={handleNavigate}
            />

            <ShareModal
                visible={showShare}
                item={selectedVideo}
                onClose={() => setShowShare(false)}
            />

            <OtherModal
                visible={showOther}
                item={selectedVideo}
                onClose={() => setShowOther(false)}
                onPlaybackSpeedChange={handlePlaybackSpeedChange}
                currentPlaybackRate={
                    selectedVideo ? videoPlaybackRates[selectedVideo.id] || 1.0 : 1.0
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    statusBarBand: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#000',
        zIndex: 20,
    },
    feedList: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        gap: 12,
    },
    loaderHint: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    loaderRetryButton: {
        marginTop: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#22D3EE',
    },
    loaderRetryText: {
        color: '#22D3EE',
        fontSize: 15,
        fontWeight: '600',
    },
    header: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
        paddingHorizontal: 16,
    },
    tabContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        marginRight: 4,
        minWidth: 0,
    },
    tab: {
        paddingVertical: 4,
        paddingHorizontal: 2,
        flexShrink: 1,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#22D3EE',
    },
    tabText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '600',
    },
    activeTabText: {
        color: 'white',
        fontWeight: '700',
    },
    searchButton: {
        width: 44,
        height: 40,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    endOfFeedContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        backgroundColor: '#000',
    },
    endOfFeedEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    endOfFeedTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    endOfFeedSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
    },
});
