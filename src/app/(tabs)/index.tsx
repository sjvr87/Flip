import CommentsModal from '@/components/feed/CommentsModal';
import FeedEmptyState from '@/components/feed/FeedEmptyState';
import OtherModal from '@/components/feed/OtherModal';
import ShareModal from '@/components/feed/ShareModal';
import VideoPlayer from '@/components/feed/VideoPlayer';
import { useAuthStore } from '@/utils/authStore';
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
const TAB_BAR_HEIGHT = 60;
const LOAD_MORE_THRESHOLD = 2;
const FEED_STALE_MS = 25_000;
const FEED_SOFT_REFRESH_MS = FEED_STALE_MS / 2;
const FEED_GC_MS = 3 * 60_000;

const fetchVideos = async ({ pageParam = null, tab }) => {
    if (tab === 'local') {
        return await fetchLocalFeed({ pageParam });
    }
    if (tab === 'forYou') {
        return await fetchForYouFeed({ pageParam });
    }
    return await fetchFollowingFeed({ pageParam });
};

export default function LoopsFeed({ navigation }) {
    const insets = useSafeAreaInsets();
    const hideForYouFeed = useAuthStore((state) => state.hideForYouFeed);
    const defaultFeed = useAuthStore((state) => state.defaultFeed);
    const [activeTab, setActiveTab] = useState(defaultFeed);
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const skipFeedTabRefreshRef = useRef(true);
    const [currentIndex, setCurrentIndex] = useState(0);
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
        refetch,
    } = useInfiniteQuery({
        queryKey: ['videos', activeTab],
        queryFn: ({ pageParam }) => fetchVideos({ pageParam, tab: activeTab }),
        getNextPageParam: (lastPage) => {
            const cursor = lastPage.meta?.next_cursor;
            return cursor && cursor.length > 0 ? cursor : undefined;
        },
        initialPageParam: null,
        staleTime: FEED_STALE_MS,
        gcTime: FEED_GC_MS,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        maxPages: 10,
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

    const videos = data?.pages?.flatMap((page) => page.data) || [];
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

    const maybeLoadMoreVideos = useCallback((visibleIndex: number) => {
        const total = videosRef.current.length;
        if (total === 0 || visibleIndex < total - LOAD_MORE_THRESHOLD) {
            return;
        }
        if (hasNextPageRef.current && !isFetchingNextPageRef.current) {
            fetchNextPageRef.current();
        }
    }, []);

    const recordVideoImpressionRef = useRef(recordVideoImpression);
    recordVideoImpressionRef.current = recordVideoImpression;

    const trimFeedToFirstPage = useCallback(
        (tab: string) => {
            queryClient.setQueryData(['videos', tab], (old) => {
                if (!old?.pages?.length) {
                    return old;
                }
                return {
                    pages: old.pages.slice(0, 1),
                    pageParams: old.pageParams.slice(0, 1),
                };
            });
        },
        [queryClient],
    );

    const refreshFeed = useCallback(
        (tab: string, mode: 'soft' | 'hard' = 'soft') => {
            const queryKey = ['videos', tab] as const;
            if (mode === 'hard') {
                trimFeedToFirstPage(tab);
                void queryClient.refetchQueries({ queryKey, type: 'active' });
                return;
            }
            void queryClient.invalidateQueries({ queryKey });
        },
        [queryClient, trimFeedToFirstPage],
    );

    const onRefresh = useCallback(async () => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        setCurrentIndex(0);
        trimFeedToFirstPage(activeTab);
        await refetch();
    }, [activeTab, refetch, trimFeedToFirstPage]);

    useFocusEffect(
        useCallback(() => {
            setScreenFocused(true);

            const state = queryClient.getQueryState(['videos', activeTab]);
            const age = Date.now() - (state?.dataUpdatedAt ?? 0);
            if (!state?.data || age >= FEED_STALE_MS) {
                refreshFeed(activeTab, 'hard');
            } else if (age >= FEED_SOFT_REFRESH_MS) {
                refreshFeed(activeTab, 'soft');
            }

            return () => {
                setScreenFocused(false);
                if (currentVideoRef.current && watchStartTimeRef.current) {
                    const watchDuration = (Date.now() - watchStartTimeRef.current) / 1000;
                    recordVideoImpressionRef.current(currentVideoRef.current, watchDuration);
                }
            };
        }, [activeTab, queryClient, refreshFeed]),
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
            const tab = activeTabRef.current;
            const state = queryClient.getQueryState(['videos', tab]);
            const age = Date.now() - (state?.dataUpdatedAt ?? 0);
            if (age >= FEED_SOFT_REFRESH_MS) {
                refreshFeed(tab, age >= FEED_STALE_MS ? 'hard' : 'soft');
            }
        });
        return () => subscription.remove();
    }, [queryClient, refreshFeed]);

    const videosWithEnd = React.useMemo(() => {
        if (!isLoading && !isFetching && videos.length === 0) {
            return [{ id: 'feed-empty', isEmptyMarker: true }];
        }
        return videos;
    }, [videos, isLoading, isFetching]);

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

            return (
                <VideoPlayer
                    key={item.id}
                    item={item}
                    isActive={index === currentIndex}
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
                    tabBarHeight={TAB_BAR_HEIGHT}
                />
            );
        },
        [
            activeTab,
            currentIndex,
            feedError,
            insets.bottom,
            onRefresh,
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
                keyExtractor={(item, index) => `${item.id}-${index}`}
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
                maxToRenderPerBatch={1}
                windowSize={3}
                initialNumToRender={1}
                updateCellsBatchingPeriod={100}
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
        borderBottomColor: 'white',
    },
    tabText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 18,
        fontWeight: '600',
    },
    activeTabText: {
        color: 'white',
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
