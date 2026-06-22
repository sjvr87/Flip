import CommentsModal from '@/components/feed/CommentsModal';
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
    type FeedTab,
    getFeedSoftRefreshMs,
    getFeedStaleMs,
    hardRefreshFeed,
    markVideoSeenInSession,
    resetSessionSeen,
    softRefreshFeed,
} from '@/utils/feedCache';
import {
    getFeedNetworkProfile,
    startFeedNetworkMonitoring,
    subscribeFeedNetworkProfile,
    type FeedNetworkProfile,
} from '@/utils/feedNetworkQuality';
import { onFeedTabChanged, releaseAllFeedPlayers, setFeedPlaybackActive } from '@/utils/feedPlaybackGuard';
import { useFlipTabBarMetrics } from '@/utils/tabBarLayout';
import { prefetchThumbnails } from '@/utils/thumbnailPrefetch';
import {
    cancelOffscreenPrefetch,
    prefetchVideoUrls,
    releaseAllVideoPrefetch,
} from '@/utils/videoPrefetch';
import {
    fetchFollowingFeed,
    fetchForYouFeed,
    fetchLocalFeed,
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
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    FlatList,
    InteractionManager,
    Platform,
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
/** Only mount expo-video players within this distance of the active slide. */
const PLAYER_PRELOAD_DISTANCE = feedPlayerPreloadDistance;

type FeedVideoCellProps = {
    item: FlipVideo;
    index: number;
    activeIndex: number;
    shouldPreload: boolean;
    feedHeight: number;
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
            onLike={onLike}
            onComment={onComment}
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

const fetchVideos = async ({
    pageParam = null,
    tab,
    refreshEpoch = 0,
}: {
    pageParam?: string | null;
    tab: FeedTab;
    refreshEpoch?: number;
}) => {
    if (tab === 'local') {
        return await fetchLocalFeed({ pageParam, refreshEpoch });
    }
    if (tab === 'forYou') {
        return await fetchForYouFeed({ pageParam, refreshEpoch });
    }
    return await fetchFollowingFeed({ pageParam, refreshEpoch });
};

/** Read tab + epoch from query key so refetches never use a stale activeTab closure. */
const feedQueryFn = ({
    pageParam,
    queryKey,
}: {
    pageParam: string | null;
    queryKey: readonly unknown[];
}) => {
    const tab = queryKey[1] as FeedTab;
    const refreshEpoch = typeof queryKey[2] === 'number' ? queryKey[2] : 0;
    return fetchVideos({ pageParam, tab, refreshEpoch });
};

const feedVideosQueryKey = (tab: FeedTab, epoch: number, viewerDid?: string | null) =>
    ['videos', tab, epoch, viewerDid ?? 'anon'] as const;

const INITIAL_FEED_EPOCHS = Object.fromEntries(FEED_TABS.map((tab) => [tab, 0])) as Record<
    (typeof FEED_TABS)[number],
    number
>;

export default function LoopsFeed({ navigation }) {
    const { height: windowHeight } = useWindowDimensions();
    const feedHeight = Math.round(windowHeight);
    const insets = useSafeAreaInsets();
    const tabBarMetrics = useFlipTabBarMetrics();
    const authReady = useAuthStore((state) => state.authReady);
    const hideForYouFeed = useAuthStore((state) => state.hideForYouFeed);
    const defaultFeed = useAuthStore((state) => state.defaultFeed);
    const hasHydrated = useAuthStore((state) => state._hasHydrated);
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
    const viewerDid = useAuthStore((state) => state.user?.id);
    const feedQueryEnabled = hasHydrated && isLoggedIn && authReady;
    const [feedEpochs, setFeedEpochs] = useState(INITIAL_FEED_EPOCHS);
    const [activeTab, setActiveTab] = useState(defaultFeed);
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
    const [showShare, setShowShare] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [videoPlaybackRates, setVideoPlaybackRates] = useState({});
    const [screenFocused, setScreenFocused] = useState(true);
    const [appActive, setAppActive] = useState(AppState.currentState === 'active');
    const [networkProfile, setNetworkProfile] = useState<FeedNetworkProfile>(() =>
        getFeedNetworkProfile(),
    );
    const feedPlaybackEnabled = screenFocused && appActive;
    const flatListRef = useRef(null);
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
            void queryClient.prefetchInfiniteQuery({
                queryKey: feedVideosQueryKey(tab, epoch, viewerDid),
                queryFn: feedQueryFn,
                initialPageParam: null,
                staleTime: getFeedStaleMs(tab),
            });
        };

        for (const tab of FEED_TABS) {
            if (tab !== activeTabRef.current) {
                prefetchTab(tab);
            }
        }
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
        queryKey: feedVideosQueryKey(activeTab, feedEpoch, viewerDid),
        queryFn: feedQueryFn,
        getNextPageParam: (lastPage) => {
            const cursor = lastPage.meta?.next_cursor;
            return cursor && cursor.length > 0 ? cursor : undefined;
        },
        initialPageParam: null,
        staleTime: getFeedStaleMs(activeTab),
        gcTime: FEED_GC_MS,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
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

    const rawVideos = useMemo(
        () => data?.pages?.flatMap((page) => page.data) ?? [],
        [data?.pages],
    );
    const videos = useMemo(
        () => dedupeFeedVideos(rawVideos, activeTab),
        [rawVideos, activeTab],
    );
    const feedTrulyEmpty = !isLoading && rawVideos.length === 0;
    const feedExhausted =
        !isLoading &&
        !isFetchingNextPage &&
        !hasNextPage &&
        videos.length > 0;
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
            const state = queryClient.getQueryState(feedVideosQueryKey(tab as FeedTab, epoch, viewerDid));
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

    const switchFeedTab = useCallback((tab: FeedTab) => {
        if (tab === activeTabRef.current) {
            return;
        }

        onFeedTabChanged();
        releaseAllVideoPrefetch();

        if (currentVideoRef.current && watchStartTimeRef.current) {
            const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
            recordVideoImpressionRef.current(currentVideoRef.current, watchDuration);
        }
        currentVideoRef.current = null;
        watchStartTimeRef.current = null;

        setActiveTab(tab);
        setCurrentIndex(0);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []);

    useEffect(() => {
        if (!isConfigLoading && appConfig) {
            if (!forYouEnabled && activeTab === 'forYou') {
                switchFeedTab('local');
            }
        }
    }, [isConfigLoading, appConfig, forYouEnabled, activeTab, switchFeedTab]);

    const onRefresh = useCallback(() => {
        const tab = activeTabRef.current;
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
        hardRefreshFeed(queryClient, tab);
    }, [bumpFeedEpoch, queryClient]);

    useEffect(() => {
        const stopNetwork = startFeedNetworkMonitoring();
        const unsubNetwork = subscribeFeedNetworkProfile(setNetworkProfile);
        return () => {
            stopNetwork();
            unsubNetwork();
        };
    }, []);

    useEffect(() => {
        setFeedPlaybackActive(feedPlaybackEnabled);
        if (!feedPlaybackEnabled) {
            releaseAllVideoPrefetch();
        }
    }, [feedPlaybackEnabled]);

    useFocusEffect(
        useCallback(() => {
            setScreenFocused(true);
            setFeedPlaybackActive(true);
            refreshFeedIfStale(activeTabRef.current, feedEpochRef.current);

            return () => {
                setScreenFocused(false);
                setFeedPlaybackActive(false);
                releaseAllFeedPlayers();
                releaseAllVideoPrefetch();
                if (currentVideoRef.current && watchStartTimeRef.current) {
                    const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
                    recordVideoImpressionRef.current(currentVideoRef.current, watchDuration);
                }
            };
        }, [refreshFeedIfStale]),
    );

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            const active = nextState === 'active';
            setAppActive(active);
            if (!active) {
                setFeedPlaybackActive(false);
                releaseAllVideoPrefetch();
            } else {
                setFeedPlaybackActive(screenFocused);
            }
            if (active) {
                for (const tab of FEED_TABS) {
                    const epoch = feedEpochsRef.current[tab] ?? 0;
                    refreshFeedIfStale(tab, epoch);
                }
            }
        });
        return () => subscription.remove();
    }, [refreshFeedIfStale, screenFocused]);

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

            if (newIndex !== currentIndexRef.current) {
                releaseAllVideoPrefetch();
            }

            maybeLoadMoreVideos(newIndex);

            setCurrentIndex(newIndex);
            currentVideoRef.current = newVideo;
            watchStartTimeRef.current = Date.now();

            if (newVideo) {
                markVideoSeenInSession(activeTabRef.current, newVideo);
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
    }, [currentIndex, videos, feedPlaybackEnabled, networkProfile.tier, networkProfile.prefetchAhead, networkProfile.playerPreloadDistance]);

    useEffect(() => {
        if (!feedPlaybackEnabled || videos.length === 0 || currentIndex !== 0) {
            return;
        }
        const prefetchAhead = Math.min(PREFETCH_AHEAD, networkProfile.prefetchAhead);
        if (prefetchAhead <= 0) {
            return;
        }
        const nextUrl = videos[1]?.media?.src_url;
        prefetchVideoUrls(nextUrl ? [nextUrl] : []);
    }, [activeTab, videos.length, feedPlaybackEnabled, networkProfile.tier, networkProfile.prefetchAhead, currentIndex]);

    const handleLike = useCallback((videoId: string, liked: boolean) => {
        const dir = liked ? 'like' : 'unlike';
        videoLikeMutation.mutate({ type: dir, id: videoId });
    }, [videoLikeMutation]);

    const handleBookmark = useCallback((videoId: string, bookmarked: boolean) => {
        const dir = bookmarked ? 'bookmark' : 'unbookmark';
        videoBookmarkMutation.mutate({ type: dir, id: videoId });
    }, [videoBookmarkMutation]);

    const handleRepost = useCallback((videoId: string, reposted: boolean) => {
        const dir = reposted ? 'repost' : 'unrepost';
        videoRepostMutation.mutate({ type: dir, id: videoId });
    }, [videoRepostMutation]);

    const handleComment = useCallback((video: FlipVideo) => {
        setSelectedVideo(video);
        setShowComments(true);
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
                            : activeTab === 'local'
                              ? 'local-end'
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
                        onLike={handleLike}
                        onComment={handleComment}
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

            return <View style={{ height: feedHeight, overflow: 'hidden' }}>{cell}</View>;
        },
        [
            activeTab,
            currentIndex,
            feedError,
            feedHeight,
            onRefresh,
            tabBarMetrics.actionRailBottom,
            tabBarMetrics.bottomInset,
            tabBarMetrics.contentHeight,
            tabBarMetrics.feedOverlayBottom,
            handleLike,
            handleComment,
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
    const feedListEmpty = videosWithEnd.length === 0;
    const showInitialLoader =
        !feedQueryEnabled ||
        (isLoading && !hasFeedData) ||
        (feedListEmpty && !feedTrulyEmpty && !feedCaughtUp && (isFetching || isFetchingNextPage));

    const handleEndReached = useCallback(() => {
        maybeLoadMoreVideos(videosRef.current.length - 1);
    }, [maybeLoadMoreVideos]);

    const getItemLayout = useCallback(
        (data, index) => ({
            length: feedHeight,
            offset: feedHeight * index,
            index,
        }),
        [feedHeight],
    );

    const refreshing = (isRefetching || isFetching) && !isFetchingNextPage && !showInitialLoader;

    if (showInitialLoader) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={[styles.header, { top: insets.top + 10 }]}>
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        accessibilityRole="tab"
                        accessibilityLabel="Following"
                        accessibilityState={{
                            selected: activeTab === 'following',
                        }}
                        style={[styles.tab, activeTab === 'following' && styles.activeTab]}
                        onPress={() => switchFeedTab('following')}>
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'following' && styles.activeTabText,
                            ]}>
                            Following
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        accessibilityRole="tab"
                        accessibilityLabel="Local"
                        accessibilityState={{
                            selected: activeTab === 'local',
                        }}
                        style={[styles.tab, activeTab === 'local' && styles.activeTab]}
                        onPress={() => switchFeedTab('local')}>
                        <Text
                            style={[styles.tabText, activeTab === 'local' && styles.activeTabText]}>
                            Local
                        </Text>
                    </TouchableOpacity>
                    {forYouEnabled && (
                        <TouchableOpacity
                            accessibilityRole="tab"
                            accessibilityLabel="For You"
                            accessibilityState={{
                                selected: activeTab === 'forYou',
                            }}
                            style={[styles.tab, activeTab === 'forYou' && styles.activeTab]}
                            onPress={() => switchFeedTab('forYou')}>
                            <Text
                                style={[
                                    styles.tabText,
                                    activeTab === 'forYou' && styles.activeTabText,
                                ]}>
                                For You
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    accessibilityLabel="Search"
                    accessibilityRole="button"
                    style={styles.searchButton}
                    onPress={() => router.push('/private/search')}>
                    <Ionicons name="search" size={28} color="white" />
                </TouchableOpacity>
            </View>

            <FlatList
                    key={activeTab}
                    ref={flatListRef}
                    style={styles.feedList}
                    data={videosWithEnd}
                    extraData={currentIndex}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => item.id ?? `feed-item-${index}`}
                    pagingEnabled
                    showsVerticalScrollIndicator={false}
                    {...(Platform.OS === 'ios'
                        ? {
                              snapToInterval: feedHeight,
                              snapToAlignment: 'start' as const,
                              decelerationRate: 'fast' as const,
                          }
                        : {})}
                    scrollEventThrottle={16}
                    overScrollMode="never"
                    viewabilityConfig={viewabilityConfig.current}
                    onViewableItemsChanged={onViewableItemsChanged}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    getItemLayout={getItemLayout}
                    removeClippedSubviews={Platform.OS !== 'android'}
                    maxToRenderPerBatch={feedMaxToRenderPerBatch}
                    windowSize={feedFlatListWindowSize}
                    initialNumToRender={feedInitialNumToRender}
                    updateCellsBatchingPeriod={50}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            progressViewOffset={insets.top + 60}
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

            <CommentsModal
                visible={showComments}
                item={selectedVideo}
                onClose={() => setShowComments(false)}
                navigation={navigation}
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
    feedList: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        paddingHorizontal: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        gap: 24,
    },
    tab: {
        paddingVertical: 8,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#22D3EE',
    },
    tabText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 18,
        fontWeight: '600',
    },
    activeTabText: {
        color: 'white',
        fontWeight: '700',
    },
    searchButton: {
        position: 'absolute',
        right: 16,
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
