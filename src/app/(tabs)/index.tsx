import CommentsModal from '@/components/feed/CommentsModal';
import FeedEmptyState from '@/components/feed/FeedEmptyState';
import OtherModal from '@/components/feed/OtherModal';
import ShareModal from '@/components/feed/ShareModal';
import VideoPlayer from '@/components/feed/VideoPlayer';
import { useAuthStore } from '@/utils/authStore';
import {
    FEED_GC_MS,
    FEED_TABS,
    dedupeFeedVideos,
    getFeedSoftRefreshMs,
    getFeedStaleMs,
    hardRefreshFeed,
    resetSessionSeen,
    softRefreshFeed,
} from '@/utils/feedCache';
import { TAB_BAR_CONTENT_HEIGHT } from '@/utils/tabBarLayout';
import { prefetchVideoUrls } from '@/utils/videoPrefetch';
import {
    fetchFollowingFeed,
    fetchForYouFeed,
    fetchLocalFeed,
    getConfiguration,
    recordImpression,
    videoBookmark,
    videoLike,
    videoUnbookmark,
    videoUnlike,
} from '@/atproto';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    Dimensions,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
/** Start loading next page when this many videos from the end (TikTok-style). */
const LOAD_MORE_THRESHOLD = 4;
/** Preload HLS for the next N videos beyond the FlatList render window. */
const PREFETCH_AHEAD = 5;
/** Stop auto-pagination when this many consecutive pages dedupe to zero new videos. */
const MAX_EMPTY_DEDUPE_FETCHES = 2;
/** Only mount expo-video players within this distance of the active slide. */
const PLAYER_PRELOAD_DISTANCE = 2;

const fetchVideos = async ({ pageParam = null, tab, refreshEpoch = 0 }) => {
    if (tab === 'local') {
        return await fetchLocalFeed({ pageParam, refreshEpoch });
    }
    if (tab === 'forYou') {
        return await fetchForYouFeed({ pageParam, refreshEpoch });
    }
    return await fetchFollowingFeed({ pageParam, refreshEpoch });
};

const INITIAL_FEED_EPOCHS = Object.fromEntries(FEED_TABS.map((tab) => [tab, 0])) as Record<
    (typeof FEED_TABS)[number],
    number
>;

export default function LoopsFeed({ navigation }) {
    const insets = useSafeAreaInsets();
    const overlayTabBarHeight = TAB_BAR_CONTENT_HEIGHT;
    const hideForYouFeed = useAuthStore((state) => state.hideForYouFeed);
    const defaultFeed = useAuthStore((state) => state.defaultFeed);
    const [feedEpochs, setFeedEpochs] = useState(INITIAL_FEED_EPOCHS);
    const [activeTab, setActiveTab] = useState(defaultFeed);
    const feedEpoch = feedEpochs[activeTab] ?? 0;
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const skipFeedTabRefreshRef = useRef(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dedupeExhausted, setDedupeExhausted] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [showComments, setShowComments] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [videoPlaybackRates, setVideoPlaybackRates] = useState({});
    const [screenFocused, setScreenFocused] = useState(true);
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
    });

    const forYouEnabled = appConfig?.fyf === true && !hideForYouFeed;

    useEffect(() => {
        if (!isConfigLoading && appConfig) {
            if (!forYouEnabled && activeTab === 'forYou') {
                setActiveTab('local');
            }
        }
    }, [isConfigLoading, appConfig, forYouEnabled, activeTab]);

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
        queryKey: ['videos', activeTab, feedEpoch],
        queryFn: ({ pageParam }) =>
            fetchVideos({ pageParam, tab: activeTab, refreshEpoch: feedEpoch }),
        getNextPageParam: (lastPage) => {
            const cursor = lastPage.meta?.next_cursor;
            return cursor && cursor.length > 0 ? cursor : undefined;
        },
        initialPageParam: null,
        staleTime: getFeedStaleMs(activeTab),
        gcTime: FEED_GC_MS,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false,
        maxPages: 25,
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

    const rawVideos = useMemo(
        () => data?.pages?.flatMap((page) => page.data) ?? [],
        [data?.pages],
    );
    const videos = useMemo(
        () => dedupeFeedVideos(rawVideos, activeTab),
        [rawVideos, activeTab],
    );
    const feedTrulyEmpty =
        !isLoading && !isFetching && rawVideos.length === 0;
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

    const hasNextPageRef = useRef(hasNextPage);
    hasNextPageRef.current = hasNextPage;
    const isFetchingNextPageRef = useRef(isFetchingNextPage);
    isFetchingNextPageRef.current = isFetchingNextPage;
    const fetchNextPageRef = useRef(fetchNextPage);
    fetchNextPageRef.current = fetchNextPage;
    const emptyDedupeFetchCountRef = useRef(0);
    const lastRawCountRef = useRef(0);

    useEffect(() => {
        emptyDedupeFetchCountRef.current = 0;
        lastRawCountRef.current = 0;
        setDedupeExhausted(false);
    }, [activeTab]);

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

    const refreshFeed = useCallback(
        (tab: string, mode: 'soft' | 'hard' = 'soft') => {
            if (mode === 'hard') {
                bumpFeedEpoch(tab);
                hardRefreshFeed(queryClient, tab);
                return;
            }
            softRefreshFeed(queryClient, tab);
        },
        [bumpFeedEpoch, queryClient],
    );

    const onRefresh = useCallback(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        setCurrentIndex(0);
        emptyDedupeFetchCountRef.current = 0;
        lastRawCountRef.current = 0;
        setDedupeExhausted(false);
        bumpFeedEpoch(activeTab);
        hardRefreshFeed(queryClient, activeTab);
    }, [activeTab, bumpFeedEpoch, queryClient]);

    useFocusEffect(
        useCallback(() => {
            setScreenFocused(true);

            const staleMs = getFeedStaleMs(activeTab);
            const softMs = getFeedSoftRefreshMs(activeTab);
            const state = queryClient.getQueryState(['videos', activeTab, feedEpoch]);
            const age = Date.now() - (state?.dataUpdatedAt ?? 0);
            if (!state?.data || age >= staleMs) {
                refreshFeed(activeTab, 'hard');
            } else if (age >= softMs) {
                refreshFeed(activeTab, 'soft');
            }

            return () => {
                setScreenFocused(false);
                if (currentVideoRef.current && watchStartTimeRef.current) {
                    const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
                    recordVideoImpressionRef.current(currentVideoRef.current, watchDuration);
                }
            };
        }, [activeTab, feedEpoch, queryClient, refreshFeed]),
    );

    useEffect(() => {
        if (skipFeedTabRefreshRef.current) {
            skipFeedTabRefreshRef.current = false;
            return;
        }
        refreshFeed(activeTab, 'soft');
    }, [activeTab, refreshFeed]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState !== 'active') {
                return;
            }
            for (const tab of FEED_TABS) {
                const epoch = feedEpochs[tab] ?? 0;
                const state = queryClient.getQueryState(['videos', tab, epoch]);
                const age = Date.now() - (state?.dataUpdatedAt ?? 0);
                const staleMs = getFeedStaleMs(tab);
                const softMs = getFeedSoftRefreshMs(tab);
                if (!state?.data || age >= staleMs) {
                    refreshFeed(tab, 'hard');
                } else if (age >= softMs) {
                    refreshFeed(tab, 'soft');
                }
            }
        });
        return () => subscription.remove();
    }, [feedEpochs, queryClient, refreshFeed]);

    useEffect(() => {
        if (videos.length > 0) {
            emptyDedupeFetchCountRef.current = 0;
            lastRawCountRef.current = rawVideos.length;
            setDedupeExhausted(false);
            return;
        }

        if (
            isLoading ||
            isFetchingNextPage ||
            !hasNextPage ||
            rawVideos.length === 0
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
            setDedupeExhausted(true);
            return;
        }

        void fetchNextPage();
    }, [
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        videos.length,
        rawVideos.length,
        fetchNextPage,
        currentIndex,
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

            maybeLoadMoreVideos(newIndex);

            if (currentVideoRef.current && watchStartTimeRef.current) {
                const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
                recordVideoImpressionRef.current(currentVideoRef.current, watchDuration);
            }

            setCurrentIndex(newIndex);
            currentVideoRef.current = newVideo;
            watchStartTimeRef.current = Date.now();
        }
    }).current;

    useEffect(() => {
        return () => {
            if (currentVideoRef.current && watchStartTimeRef.current) {
                const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
                recordVideoImpression(currentVideoRef.current, watchDuration);
            }
        };
    }, [activeTab, recordVideoImpression]);

    useEffect(() => {
        if (videos.length === 0) {
            return;
        }
        const ahead = [];
        for (let i = 0; i <= PREFETCH_AHEAD; i++) {
            ahead.push(videos[currentIndex + i]?.media?.src_url);
        }
        prefetchVideoUrls(ahead);
    }, [currentIndex, videos]);

    useEffect(() => {
        if (videos.length > 0 && currentIndex === 0) {
            prefetchVideoUrls(videos.slice(1, PREFETCH_AHEAD + 2).map((v) => v.media?.src_url));
        }
    }, [activeTab, videos.length]);

    const handleLike = (videoId, liked) => {
        const dir = liked ? 'like' : 'unlike';
        videoLikeMutation.mutate({ type: dir, id: videoId });
    };

    const handleBookmark = (videoId, bookmarked) => {
        const dir = bookmarked ? 'bookmark' : 'unbookmark';
        videoBookmarkMutation.mutate({ type: dir, id: videoId });
    };

    const handleComment = (video) => {
        setSelectedVideo(video);
        setShowComments(true);
    };

    const handleShare = (video) => {
        setSelectedVideo(video);
        setShowShare(true);
    };

    const handleOther = (video) => {
        setSelectedVideo(video);
        setShowOther(true);
    };

    const handlePlaybackSpeedChange = (speed) => {
        if (selectedVideo) {
            setVideoPlaybackRates((prev) => ({
                ...prev,
                [selectedVideo.id]: speed,
            }));
        }
    };

    const handleNavigate = () => {
        setShowComments(false);
        setShowShare(false);
        setShowOther(false);
    };

    const renderItem = useCallback(
        ({ item, index }) => {
            if (item.isEmptyMarker) {
                return (
                    <FeedEmptyState
                        tab={activeTab}
                        onRefresh={onRefresh}
                        error={feedError}
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
                    />
                );
            }

            return (
                <VideoPlayer
                    key={item.id}
                    item={item}
                    isActive={index === currentIndex}
                    shouldPreload={Math.abs(index - currentIndex) <= PLAYER_PRELOAD_DISTANCE}
                    onLike={handleLike}
                    onComment={handleComment}
                    onShare={handleShare}
                    onBookmark={handleBookmark}
                    onOther={handleOther}
                    bottomInset={insets.bottom}
                    commentsOpen={showComments && selectedVideo?.id === item.id}
                    shareOpen={showShare && selectedVideo?.id === item.id}
                    otherOpen={showOther && selectedVideo?.id === item.id}
                    onMorePress={handleComment}
                    screenFocused={screenFocused}
                    videoPlaybackRates={videoPlaybackRates}
                    navigation={navigation}
                    onNavigate={handleNavigate}
                    tabBarHeight={overlayTabBarHeight}
                />
            );
        },
        [
            activeTab,
            currentIndex,
            feedError,
            insets.bottom,
            onRefresh,
            overlayTabBarHeight,
            showComments,
            showShare,
            showOther,
            selectedVideo,
            screenFocused,
            videoPlaybackRates,
        ],
    );

    const refreshing = (isRefetching || isFetching) && !isFetchingNextPage && !isLoading;

    const handleEndReached = useCallback(() => {
        maybeLoadMoreVideos(videosRef.current.length - 1);
    }, [maybeLoadMoreVideos]);

    const getItemLayout = useCallback(
        (data, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
        }),
        [],
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
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
                        onPress={() => {
                            setActiveTab('following');
                            setCurrentIndex(0);
                            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                        }}>
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
                        onPress={() => {
                            setActiveTab('local');
                            setCurrentIndex(0);
                            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                        }}>
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
                            onPress={() => {
                                setActiveTab('forYou');
                                setCurrentIndex(0);
                                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                            }}>
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
                ref={flatListRef}
                data={videosWithEnd}
                renderItem={renderItem}
                keyExtractor={(item, index) => item.id ?? `feed-item-${index}`}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={SCREEN_HEIGHT}
                snapToAlignment="start"
                decelerationRate="fast"
                viewabilityConfig={viewabilityConfig.current}
                onViewableItemsChanged={onViewableItemsChanged}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                getItemLayout={getItemLayout}
                removeClippedSubviews={true}
                maxToRenderPerBatch={3}
                windowSize={7}
                initialNumToRender={3}
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
                        <View style={styles.footer}>
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
        borderBottomColor: '#F02C56',
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
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    endOfFeedContainer: {
        height: SCREEN_HEIGHT,
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
