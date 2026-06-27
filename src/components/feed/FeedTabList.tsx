import FeedEmptyState from '@/components/feed/FeedEmptyState';
import VideoPlayer from '@/components/feed/VideoPlayer';
import type { FlipVideo } from '@/atproto/types';
import {
    feedCellMountRadius,
    feedFlatListWindowSize,
    feedInitialNumToRender,
    feedMaxToRenderPerBatch,
    feedPlayerPreloadDistance,
    feedPrefetchAhead,
} from '@/utils/androidVideoSafeMode';
import {
    dedupeFeedVideos,
    type FeedInfiniteCache,
    type FeedInfiniteCache,
    type FeedTab,
    getFeedStaleMs,
    markVideoSeenInSession,
    warmFeedVideosNearIndex,
} from '@/utils/feedCache';
import {
    getFeedNetworkProfile,
    subscribeFeedNetworkProfile,
    type FeedNetworkProfile,
} from '@/utils/feedNetworkQuality';
import { feedQueryFn, feedVideosQueryKey } from '@/utils/feedQuery';
import { pauseAllFeedPlayers } from '@/utils/feedPlaybackGuard';
import { getFeedVideoBandInsets } from '@/utils/tabBarLayout';
import { isRigorousFeedSwipe, resolveFeedSnapIndex } from '@/utils/feedScrollSnap';
import { FeedScrollGestureRoot } from '@/utils/feedScrollGesture';
import { prefetchThumbnails } from '@/utils/thumbnailPrefetch';
import {
    cancelOffscreenPrefetch,
    prefetchVideoUrls,
} from '@/utils/videoPrefetch';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    FlatList,
    InteractionManager,
    NativeScrollEvent,
    NativeSyntheticEvent,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';

const LOAD_MORE_THRESHOLD = 4;
const PREFETCH_AHEAD = feedPrefetchAhead;
const PLAYER_PRELOAD_DISTANCE = feedPlayerPreloadDistance;
const MAX_EMPTY_DEDUPE_FETCHES = 8;
const FEED_LOADER_TIMEOUT_MS = 18_000;

export type FeedTabListHandle = {
    scrollToTop: () => void;
};

type FeedVideoCellProps = {
    item: FlipVideo;
    index: number;
    activeIndex: number;
    shouldPreload: boolean;
    shouldMountCell: boolean;
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
    shouldMountCell,
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
    if (!shouldMountCell) {
        return <View style={{ height: feedHeight, backgroundColor: '#000' }} />;
    }

    return (
        <VideoPlayer
            item={item}
            isActive={index === activeIndex}
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

export type FeedTabListProps = {
    tab: FeedTab;
    isActive: boolean;
    tabEnabled: boolean;
    feedEpoch: number;
    feedQueryEnabled: boolean;
    viewerDid: string | null | undefined;
    feedHeight: number;
    statusBarInset: number;
    bottomInset: number;
    tabBarContentHeight: number;
    feedOverlayBottom: number;
    actionRailBottom: number;
    screenFocused: boolean;
    feedPlaybackEnabled: boolean;
    manualRefreshing: boolean;
    selectedVideo: FlipVideo | null;
    showComments: boolean;
    showShare: boolean;
    showOther: boolean;
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
    onRefresh: () => void;
    onRecordImpression?: (video: FlipVideo, duration: number) => void;
};

const FeedTabList = forwardRef<FeedTabListHandle, FeedTabListProps>(function FeedTabList(
    {
        tab,
        isActive,
        tabEnabled,
        feedEpoch,
        feedQueryEnabled,
        viewerDid,
        feedHeight,
        statusBarInset,
        bottomInset,
        tabBarContentHeight,
        feedOverlayBottom,
        actionRailBottom,
        screenFocused,
        feedPlaybackEnabled,
        manualRefreshing,
        selectedVideo,
        showComments,
        showShare,
        showOther,
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
        onRefresh,
        onRecordImpression,
    },
    ref,
) {
    const queryClient = useQueryClient();
    const feedVideoBand = useMemo(() => getFeedVideoBandInsets(), []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dedupeExhausted, setDedupeExhausted] = useState(false);
    const [loaderTimedOut, setLoaderTimedOut] = useState(false);
    const [networkProfile, setNetworkProfile] = useState<FeedNetworkProfile>(() =>
        getFeedNetworkProfile(),
    );

    const flatListRef = useRef<FlatList>(null);
    const isSnappingRef = useRef(false);
    const rigorousSnapRef = useRef(false);
    const scrollStartIndexRef = useRef(0);
    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;
    const currentVideoRef = useRef<FlipVideo | null>(null);
    const watchStartTimeRef = useRef<number | null>(null);
    const videosRef = useRef<FlipVideo[]>([]);
    const hasNextPageRef = useRef(false);
    const isFetchingNextPageRef = useRef(false);
    const fetchNextPageRef = useRef<() => Promise<unknown>>(async () => undefined);
    const emptyDedupeFetchCountRef = useRef(0);
    const lastRawCountRef = useRef(0);
    const lastVideosCountRef = useRef(0);
    const stagnantPageFetchCountRef = useRef(0);
    const autoFetchInFlightRef = useRef(false);
    const dedupeExhaustedRef = useRef(false);
    const onRecordImpressionRef = useRef(onRecordImpression);
    onRecordImpressionRef.current = onRecordImpression;
    const isActiveRef = useRef(isActive);
    isActiveRef.current = isActive;

    useImperativeHandle(ref, () => ({
        scrollToTop: () => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            setCurrentIndex(0);
        },
    }));

    useEffect(() => subscribeFeedNetworkProfile(setNetworkProfile), []);

    const queryEnabled = feedQueryEnabled && tabEnabled;

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
        queryKey: feedVideosQueryKey(tab, feedEpoch, viewerDid),
        queryFn: feedQueryFn,
        getNextPageParam: (lastPage) => {
            const cursor = lastPage.meta?.next_cursor;
            return cursor && cursor.length > 0 ? cursor : undefined;
        },
        initialPageParam: null,
        staleTime: getFeedStaleMs(tab),
        gcTime: 2 * 60_000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        placeholderData: () =>
            queryClient.getQueryData<FeedInfiniteCache>(
                feedVideosQueryKey(tab, feedEpoch, viewerDid),
            ),
        maxPages: 25,
        enabled: queryEnabled,
    });

    const rawVideos = useMemo(() => data?.pages?.flatMap((page) => page.data) ?? [], [data?.pages]);
    const videos = useMemo(() => dedupeFeedVideos(rawVideos, tab), [rawVideos, tab]);
    videosRef.current = videos;
    hasNextPageRef.current = !!hasNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
    fetchNextPageRef.current = fetchNextPage;

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

    useEffect(() => {
        emptyDedupeFetchCountRef.current = 0;
        lastRawCountRef.current = 0;
        lastVideosCountRef.current = 0;
        stagnantPageFetchCountRef.current = 0;
        autoFetchInFlightRef.current = false;
        dedupeExhaustedRef.current = false;
        setDedupeExhausted(false);
    }, [feedEpoch]);

    const maybeLoadMoreVideos = useCallback((visibleIndex: number) => {
        const total = videosRef.current.length;
        if (total === 0 || visibleIndex < total - LOAD_MORE_THRESHOLD) {
            return;
        }
        if (hasNextPageRef.current && !isFetchingNextPageRef.current) {
            void fetchNextPageRef.current();
        }
    }, []);

    const videosWithEnd = useMemo(() => {
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

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    });

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
        if (!isActiveRef.current || viewableItems.length === 0) {
            return;
        }
        const newIndex = viewableItems[0].index || 0;
        const newVideo = videosRef.current[newIndex] as FlipVideo | undefined;
        const prevVideo = currentVideoRef.current;
        const prevWatchStart = watchStartTimeRef.current;

        if (newIndex !== currentIndexRef.current) {
            pauseAllFeedPlayers();
        }

        maybeLoadMoreVideos(newIndex);
        setCurrentIndex(newIndex);
        currentVideoRef.current = newVideo ?? null;
        watchStartTimeRef.current = Date.now();

        if (newVideo) {
            markVideoSeenInSession(tab, newVideo);
            warmFeedVideosNearIndex(videosRef.current, newIndex, prefetchThumbnails);
        }

        if (prevVideo && prevWatchStart) {
            InteractionManager.runAfterInteractions(() => {
                const watchDuration = (Date.now() - prevWatchStart) / 1000;
                onRecordImpressionRef.current?.(prevVideo, watchDuration);
            });
        }
    }).current;

    useEffect(() => {
        if (isActive) {
            return;
        }
        if (currentVideoRef.current && watchStartTimeRef.current) {
            const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
            onRecordImpressionRef.current?.(currentVideoRef.current, watchDuration);
        }
        currentVideoRef.current = null;
        watchStartTimeRef.current = null;
    }, [isActive]);

    useEffect(() => {
        if (!isActive || !feedPlaybackEnabled || videos.length === 0) {
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
            const nextUrls: string[] = [];
            for (let i = 1; i <= prefetchAhead + 1; i += 1) {
                const url = videos[currentIndex + i]?.media?.src_url;
                if (url) {
                    nextUrls.push(url);
                }
            }
            prefetchVideoUrls(nextUrls);
        }

        warmFeedVideosNearIndex(videos, currentIndex, prefetchThumbnails);
    }, [
        isActive,
        currentIndex,
        videos,
        feedPlaybackEnabled,
        networkProfile.prefetchAhead,
        networkProfile.playerPreloadDistance,
    ]);

    useEffect(() => {
        if (!isActive || !feedPlaybackEnabled || videos.length === 0) {
            return;
        }
        warmFeedVideosNearIndex(videos, 0, prefetchThumbnails, 8);
        const prefetchAhead = Math.min(PREFETCH_AHEAD, networkProfile.prefetchAhead);
        const urls: string[] = [];
        for (let i = 0; i <= prefetchAhead + 1; i += 1) {
            const url = videos[i]?.media?.src_url;
            if (url) {
                urls.push(url);
            }
        }
        prefetchVideoUrls(urls);
    }, [isActive, tab, videos, feedPlaybackEnabled, networkProfile.prefetchAhead, feedEpoch]);

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
            !isActive ||
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
        isActive,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        videos.length,
        rawVideos.length,
        currentIndex,
        feedEpoch,
    ]);

    const snapFeedFromScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>, animated = true) => {
            const { contentOffset, velocity } = event.nativeEvent;
            const target = resolveFeedSnapIndex(
                contentOffset.y,
                feedHeight,
                velocity?.y,
                videosWithEnd.length,
                scrollStartIndexRef.current,
            );
            const targetOffset = target * feedHeight;

            warmFeedVideosNearIndex(videosRef.current, target, prefetchThumbnails);

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
        isSnappingRef.current = false;
        rigorousSnapRef.current = false;
    }, []);

    const handleScrollEndDrag = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentOffset, velocity } = event.nativeEvent;
            const velocityY = velocity?.y ?? 0;

            if (
                isRigorousFeedSwipe(
                    contentOffset.y,
                    feedHeight,
                    velocityY,
                    scrollStartIndexRef.current,
                )
            ) {
                rigorousSnapRef.current = true;
                snapFeedFromScroll(event, false);
                return;
            }

            if (Math.abs(velocityY) < 0.35) {
                snapFeedFromScroll(event, false);
            }
        },
        [feedHeight, snapFeedFromScroll],
    );

    const handleMomentumScrollEnd = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (rigorousSnapRef.current) {
                rigorousSnapRef.current = false;
                return;
            }
            snapFeedFromScroll(event, false);
        },
        [snapFeedFromScroll],
    );

    const getItemLayout = useCallback(
        (_data: unknown, index: number) => ({
            length: feedHeight,
            offset: feedHeight * index,
            index,
        }),
        [feedHeight],
    );

    const handleEndReached = useCallback(() => {
        maybeLoadMoreVideos(videosRef.current.length - 1);
    }, [maybeLoadMoreVideos]);

    const renderItem = useCallback(
        ({ item, index }: { item: FlipVideo & { isEmptyMarker?: boolean; isEndMarker?: boolean }; index: number }) => {
            const cell = (() => {
                if (item.isEmptyMarker) {
                    return (
                        <FeedEmptyState
                            tab={tab}
                            onRefresh={onRefresh}
                            error={feedError}
                            itemHeight={feedHeight}
                        />
                    );
                }

                if (item.isEndMarker) {
                    const endTab =
                        tab === 'forYou'
                            ? 'forYou-end'
                            : tab === 'trending'
                              ? 'trending-end'
                              : 'following-end';
                    return (
                        <FeedEmptyState tab={endTab} onRefresh={onRefresh} itemHeight={feedHeight} />
                    );
                }

                const distance = Math.abs(index - currentIndex);
                const shouldMountCell = distance <= feedCellMountRadius;
                const shouldPreloadPlayer =
                    isActive &&
                    feedPlaybackEnabled &&
                    (index === currentIndex || distance <= PLAYER_PRELOAD_DISTANCE);

                return (
                    <FeedVideoCell
                        item={item}
                        index={index}
                        activeIndex={currentIndex}
                        shouldPreload={shouldPreloadPlayer}
                        shouldMountCell={shouldMountCell}
                        feedHeight={feedHeight}
                        videoTopInset={feedVideoBand.top}
                        videoBottomReserved={feedVideoBand.bottom}
                        onLike={onLike}
                        onComment={onComment}
                        onCaptionExpand={onCaptionExpand}
                        onShare={onShare}
                        onBookmark={onBookmark}
                        onRepost={onRepost}
                        onOther={onOther}
                        bottomInset={bottomInset}
                        commentsOpen={showComments && selectedVideo?.id === item.id}
                        shareOpen={showShare && selectedVideo?.id === item.id}
                        otherOpen={showOther && selectedVideo?.id === item.id}
                        screenFocused={screenFocused}
                        feedPlaybackEnabled={feedPlaybackEnabled && isActive}
                        videoPlaybackRates={videoPlaybackRates}
                        navigation={navigation}
                        onNavigate={onNavigate}
                        tabBarHeight={tabBarContentHeight}
                        feedOverlayBottom={feedOverlayBottom}
                        actionRailBottom={actionRailBottom}
                    />
                );
            })();

            return (
                <View style={{ height: feedHeight, overflow: 'hidden', backgroundColor: '#000' }}>
                    {cell}
                </View>
            );
        },
        [
            tab,
            currentIndex,
            feedError,
            feedHeight,
            feedVideoBand.bottom,
            feedVideoBand.top,
            onRefresh,
            bottomInset,
            feedOverlayBottom,
            actionRailBottom,
            tabBarContentHeight,
            onLike,
            onComment,
            onCaptionExpand,
            onShare,
            onBookmark,
            onRepost,
            onOther,
            onNavigate,
            showComments,
            showShare,
            showOther,
            selectedVideo,
            screenFocused,
            feedPlaybackEnabled,
            isActive,
            videoPlaybackRates,
            navigation,
        ],
    );

    const hasFeedData = (data?.pages?.length ?? 0) > 0;
    const showInitialLoader = !feedQueryEnabled || (isLoading && !hasFeedData);

    useEffect(() => {
        if (!showInitialLoader || !isActive) {
            setLoaderTimedOut(false);
            return;
        }
        const timer = setTimeout(() => setLoaderTimedOut(true), FEED_LOADER_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [showInitialLoader, isActive, feedEpoch]);

    const showBlockingLoader = isActive && showInitialLoader && !loaderTimedOut && !feedError;
    const showError = isActive && (loaderTimedOut || feedError);
    const refreshing = isActive && manualRefreshing && (isRefetching || isFetching) && !isFetchingNextPage;

    if (showBlockingLoader || showError) {
        return (
            <View style={styles.pane}>
                {showBlockingLoader ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                ) : (
                    <FeedEmptyState
                        tab={tab}
                        onRefresh={onRefresh}
                        error={
                            feedError ||
                            (loaderTimedOut
                                ? 'Feed is taking too long. Tap retry or pull down.'
                                : null)
                        }
                        itemHeight={feedHeight}
                    />
                )}
            </View>
        );
    }

    return (
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
                scrollEnabled={isActive}
                refreshControl={
                    isActive ? (
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            progressViewOffset={statusBarInset + 40}
                        />
                    ) : undefined
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
    );
});

export default FeedTabList;

const styles = StyleSheet.create({
    pane: {
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
    footer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
