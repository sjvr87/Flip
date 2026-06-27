import CommentsModal from '@/components/feed/CommentsModal';
import CaptionExpandModal from '@/components/feed/CaptionExpandModal';
import FeedTabList, { type FeedTabListHandle } from '@/components/feed/FeedTabList';
import OtherModal from '@/components/feed/OtherModal';
import ShareModal from '@/components/feed/ShareModal';
import { useAuthStore } from '@/utils/authStore';
import {
    FEED_TABS,
    type FeedTab,
    getFeedSoftRefreshMs,
    getFeedStaleMs,
    hardRefreshFeed,
    resetSessionSeen,
    softRefreshFeed,
    warmFeedTabMedia,
} from '@/utils/feedCache';
import { feedQueryFn, feedVideosQueryKey } from '@/utils/feedQuery';
import {
    startFeedNetworkMonitoring,
    subscribeFeedNetworkProfile,
    type FeedNetworkProfile,
} from '@/utils/feedNetworkQuality';
import {
    onFeedTabChanged,
    pauseAllFeedPlayers,
    setAppInForeground,
    subscribeFeedPlaybackActive,
    isFeedPlaybackActive,
} from '@/utils/feedPlaybackGuard';
import { computeFeedVideoViewport, useFlipTabBarMetrics } from '@/utils/tabBarLayout';
import { prefetchThumbnails } from '@/utils/thumbnailPrefetch';
import { prefetchVideoUrls, releaseAllVideoPrefetch } from '@/utils/videoPrefetch';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router/react-navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    PixelRatio,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INITIAL_FEED_EPOCHS = Object.fromEntries(FEED_TABS.map((tab) => [tab, 0])) as Record<
    (typeof FEED_TABS)[number],
    number
>;

export default function LoopsFeed({ navigation }) {
    const { height: windowHeight } = useWindowDimensions();
    const feedHeight = PixelRatio.roundToNearestPixel(windowHeight);
    const insets = useSafeAreaInsets();
    const tabBarMetrics = useFlipTabBarMetrics();
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
    const normalizedDefault = defaultFeed === 'local' ? 'trending' : defaultFeed;
    const [activeTab, setActiveTab] = useState<FeedTab>(normalizedDefault as FeedTab);
    const feedEpochsRef = useRef(feedEpochs);
    feedEpochsRef.current = feedEpochs;
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const [selectedVideo, setSelectedVideo] = useState<FlipVideo | null>(null);
    const [showComments, setShowComments] = useState(false);
    const [showCaptionExpand, setShowCaptionExpand] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [videoPlaybackRates, setVideoPlaybackRates] = useState<Record<string, number>>({});
    const [screenFocused, setScreenFocused] = useState(true);
    const [appActive, setAppActive] = useState(AppState.currentState === 'active');
    const [guardPlaybackActive, setGuardPlaybackActive] = useState(isFeedPlaybackActive);
    const [manualRefreshing, setManualRefreshing] = useState(false);
    const [, setNetworkProfile] = useState<FeedNetworkProfile>(() => ({} as FeedNetworkProfile));
    const feedPlaybackEnabled = screenFocused && appActive && guardPlaybackActive;
    const tabListRefs = useRef<Partial<Record<FeedTab, FeedTabListHandle | null>>>({});
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => subscribeFeedPlaybackActive(setGuardPlaybackActive), []);

    const { data: appConfig, isLoading: isConfigLoading } = useQuery({
        queryKey: ['appConfig'],
        queryFn: getConfiguration,
        enabled: feedQueryEnabled,
    });

    const forYouEnabled = appConfig?.fyf === true && !hideForYouFeed;
    const visibleTabs = useMemo(
        () => (forYouEnabled ? FEED_TABS : FEED_TABS.filter((tab) => tab !== 'forYou')),
        [forYouEnabled],
    );

    const recordVideoImpression = useCallback(
        async (video: FlipVideo, duration: number) => {
            if (activeTabRef.current !== 'forYou' || !video || duration < 1) {
                return;
            }
            const videoDuration = video.media.duration || 0;
            const completed = videoDuration > 0 && duration >= videoDuration * 0.9;
            await recordImpression(video.id, duration, completed);
        },
        [],
    );

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
            if (age >= getFeedSoftRefreshMs(tab)) {
                softRefreshFeed(queryClient, tab);
            }
        },
        [queryClient, viewerDid],
    );

    useEffect(() => {
        if (!feedQueryEnabled) {
            return;
        }
        const epochs = feedEpochsRef.current;
        for (const tab of FEED_TABS) {
            if (tab === 'forYou' && !forYouEnabled) {
                continue;
            }
            const epoch = epochs[tab] ?? 0;
            warmFeedTabMedia(queryClient, tab, epoch, viewerDid, {
                prefetchThumbnails,
                prefetchVideoUrls,
            });
            void queryClient
                .prefetchInfiniteQuery({
                    queryKey: feedVideosQueryKey(tab, epoch, viewerDid),
                    queryFn: feedQueryFn,
                    initialPageParam: null,
                    staleTime: getFeedStaleMs(tab),
                })
                .then(() => {
                    warmFeedTabMedia(queryClient, tab, epoch, viewerDid, {
                        prefetchThumbnails,
                        prefetchVideoUrls,
                    });
                });
        }
    }, [feedQueryEnabled, forYouEnabled, queryClient, viewerDid]);

    const warmFeedTab = useCallback(
        (tab: FeedTab) => {
            if (tab === activeTabRef.current || (tab === 'forYou' && !forYouEnabled)) {
                return;
            }
            const epoch = feedEpochsRef.current[tab] ?? 0;
            warmFeedTabMedia(queryClient, tab, epoch, viewerDid, {
                prefetchThumbnails,
                prefetchVideoUrls,
            });
            void queryClient.prefetchInfiniteQuery({
                queryKey: feedVideosQueryKey(tab, epoch, viewerDid),
                queryFn: feedQueryFn,
                initialPageParam: null,
                staleTime: getFeedStaleMs(tab),
            });
        },
        [forYouEnabled, queryClient, viewerDid],
    );

    const switchFeedTab = useCallback(
        (tab: FeedTab) => {
            if (tab === activeTabRef.current) {
                return;
            }
            warmFeedTabMedia(queryClient, tab, feedEpochsRef.current[tab] ?? 0, viewerDid, {
                prefetchThumbnails,
                prefetchVideoUrls,
            });
            pauseAllFeedPlayers();
            onFeedTabChanged();
            setActiveTab(tab);
            requestAnimationFrame(() => {
                refreshFeedIfStale(tab, feedEpochsRef.current[tab] ?? 0);
            });
        },
        [queryClient, refreshFeedIfStale, viewerDid],
    );

    useEffect(() => {
        if (!isConfigLoading && appConfig && !forYouEnabled && activeTab === 'forYou') {
            switchFeedTab('trending');
        }
    }, [isConfigLoading, appConfig, forYouEnabled, activeTab, switchFeedTab]);

    const onRefresh = useCallback(() => {
        const tab = activeTabRef.current;
        setManualRefreshing(true);
        onFeedTabChanged();
        tabListRefs.current[tab]?.scrollToTop();
        bumpFeedEpoch(tab);
        invalidateFollowingDidsCache();
        queryClient.invalidateQueries({ queryKey: ['followingDids'] });
        hardRefreshFeed(queryClient, tab);
    }, [bumpFeedEpoch, queryClient]);

    useEffect(() => {
        if (!manualRefreshing) {
            return;
        }
        const state = queryClient.getQueryState(
            feedVideosQueryKey(activeTab, feedEpochs[activeTab] ?? 0, viewerDid),
        );
        if (state?.fetchStatus === 'idle') {
            setManualRefreshing(false);
        }
    }, [manualRefreshing, activeTab, feedEpochs, queryClient, viewerDid]);

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
            refreshFeedIfStale(activeTabRef.current, feedEpochsRef.current[activeTabRef.current] ?? 0);
            return () => {
                setScreenFocused(false);
                releaseAllVideoPrefetch();
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
            } else {
                for (const tab of FEED_TABS) {
                    refreshFeedIfStale(tab, feedEpochsRef.current[tab] ?? 0);
                }
            }
        });
        return () => subscription.remove();
    }, [refreshFeedIfStale]);

    const videoLikeMutation = useMutation({
        mutationFn: async (data: { type: string; id: string }) => {
            if (data.type === 'like') {
                return await videoLike(data.id);
            }
            return await videoUnlike(data.id);
        },
    });

    const videoBookmarkMutation = useMutation({
        mutationFn: async (data: { type: string; id: string }) => {
            if (data.type === 'bookmark') {
                return await videoBookmark(data.id);
            }
            return await videoUnbookmark(data.id);
        },
    });

    const videoRepostMutation = useMutation({
        mutationFn: async (data: { type: string; id: string }) => {
            if (data.type === 'repost') {
                return await videoRepost(data.id);
            }
            return await videoUnrepost(data.id);
        },
    });

    const handleLike = useCallback(
        (videoId: string, liked: boolean) => {
            videoLikeMutation.mutate({ type: liked ? 'like' : 'unlike', id: videoId });
        },
        [videoLikeMutation],
    );

    const handleBookmark = useCallback(
        (videoId: string, bookmarked: boolean) => {
            videoBookmarkMutation.mutate({ type: bookmarked ? 'bookmark' : 'unbookmark', id: videoId });
        },
        [videoBookmarkMutation],
    );

    const handleRepost = useCallback(
        (videoId: string, reposted: boolean) => {
            videoRepostMutation.mutate({ type: reposted ? 'repost' : 'unrepost', id: videoId });
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

    const handlePlaybackSpeedChange = (speed: number) => {
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

    const feedHeader = (
        <View style={[styles.header, { top: statusBarInset }]}>
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    accessibilityRole="tab"
                    accessibilityLabel="Following"
                    accessibilityState={{ selected: activeTab === 'following' }}
                    style={[styles.tab, activeTab === 'following' && styles.activeTab]}
                    onPressIn={() => warmFeedTab('following')}
                    onPress={() => switchFeedTab('following')}>
                    <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
                        Following
                    </Text>
                </TouchableOpacity>
                {forYouEnabled && (
                    <TouchableOpacity
                        accessibilityRole="tab"
                        accessibilityLabel="FYP"
                        accessibilityState={{ selected: activeTab === 'forYou' }}
                        style={[styles.tab, activeTab === 'forYou' && styles.activeTab]}
                        onPressIn={() => warmFeedTab('forYou')}
                        onPress={() => switchFeedTab('forYou')}>
                        <Text style={[styles.tabText, activeTab === 'forYou' && styles.activeTabText]}>
                            FYP
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    accessibilityRole="tab"
                    accessibilityLabel="Trending"
                    accessibilityState={{ selected: activeTab === 'trending' }}
                    style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
                    onPressIn={() => warmFeedTab('trending')}
                    onPress={() => switchFeedTab('trending')}>
                    <Text style={[styles.tabText, activeTab === 'trending' && styles.activeTabText]}>
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
            <View pointerEvents="none" style={[styles.statusBarBand, { height: statusBarInset }]} />
            {feedHeader}

            <View style={styles.feedPanes}>
                {visibleTabs.map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <View
                            key={tab}
                            style={[
                                styles.feedPane,
                                isActive ? styles.feedPaneActive : styles.feedPaneHidden,
                            ]}
                            pointerEvents={isActive ? 'auto' : 'none'}>
                            <FeedTabList
                                ref={(handle) => {
                                    tabListRefs.current[tab] = handle;
                                }}
                                tab={tab}
                                isActive={isActive}
                                tabEnabled={tab !== 'forYou' || forYouEnabled}
                                feedEpoch={feedEpochs[tab] ?? 0}
                                feedQueryEnabled={feedQueryEnabled}
                                viewerDid={viewerDid}
                                feedHeight={feedHeight}
                                statusBarInset={statusBarInset}
                                bottomInset={tabBarMetrics.bottomInset}
                                tabBarContentHeight={tabBarMetrics.contentHeight}
                                feedOverlayBottom={tabBarMetrics.feedOverlayBottom}
                                actionRailBottom={tabBarMetrics.actionRailBottom}
                                screenFocused={screenFocused}
                                feedPlaybackEnabled={feedPlaybackEnabled}
                                manualRefreshing={manualRefreshing && isActive}
                                selectedVideo={selectedVideo}
                                showComments={showComments}
                                showShare={showShare}
                                showOther={showOther}
                                videoPlaybackRates={videoPlaybackRates}
                                navigation={navigation}
                                onLike={handleLike}
                                onComment={handleComment}
                                onCaptionExpand={handleCaptionExpand}
                                onShare={handleShare}
                                onBookmark={handleBookmark}
                                onRepost={handleRepost}
                                onOther={handleOther}
                                onNavigate={handleNavigate}
                                onRefresh={onRefresh}
                                onRecordImpression={recordVideoImpression}
                            />
                        </View>
                    );
                })}
            </View>

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
    feedPanes: {
        flex: 1,
    },
    feedPane: {
        ...StyleSheet.absoluteFillObject,
    },
    feedPaneActive: {
        opacity: 1,
        zIndex: 1,
    },
    feedPaneHidden: {
        opacity: 0,
        zIndex: 0,
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
});
