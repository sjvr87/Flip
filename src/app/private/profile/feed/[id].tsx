import CommentsModal from '@/components/feed/CommentsModal';
import OtherModal from '@/components/feed/OtherModal';
import PhotoFeedSlide from '@/components/feed/PhotoFeedSlide';
import ShareModal from '@/components/feed/ShareModal';
import VideoPlayer from '@/components/feed/VideoPlayer';
import {
    commentDelete,
    commentLike,
    commentPost,
    commentReplyDelete,
    commentReplyLike,
    commentReplyUnlike,
    commentUnlike,
    fetchUserVideoCursor as atprotoFetchUserVideoCursor,
    fetchVideoComments,
    fetchVideoReplies,
    videoBookmark as atprotoVideoBookmark,
    videoLike as atprotoVideoLike,
    videoUnbookmark as atprotoVideoUnbookmark,
    videoUnlike as atprotoVideoUnlike,
} from '@/atproto';
import {
    fetchUserVideoCursor,
    usesAtprotoBackend,
    videoBookmark,
    videoLike,
    videoUnbookmark,
    videoUnlike,
} from '@/utils/requests';
import { decodeRouteParam, parseRepoDidFromAtUri } from '@/utils/profileNavigation';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileFeed({ navigation }) {
    const params = useLocalSearchParams();
    const id = decodeRouteParam(params.id);
    const profileId = decodeRouteParam(params.profileId) || parseRepoDidFromAtUri(id);
    const shouldOpenComments =
        params.openComments === '1' || params.openComments === 'true';
    const atproto = usesAtprotoBackend();

    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState('forYou');
    const [currentIndex, setCurrentIndex] = useState(0);
    const hasScrolledToTarget = useRef(false);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [showComments, setShowComments] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [videoPlaybackRates, setVideoPlaybackRates] = useState({});
    const [screenFocused, setScreenFocused] = useState(true);
    const [feedHeight, setFeedHeight] = useState(0);
    const flatListRef = useRef(null);
    const router = useRouter();

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    });

    useFocusEffect(
        useCallback(() => {
            setScreenFocused(true);
            return () => {
                setScreenFocused(false);
            };
        }, []),
    );

    const onContainerLayout = useCallback((e) => {
        const h = e.nativeEvent.layout.height;
        setFeedHeight((prev) => (h > 0 && Math.abs(h - prev) > 1 ? h : prev));
    }, []);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
        queryKey: ['profileVideoFeed', profileId, id],
        queryFn: ({ pageParam }) =>
            (atproto ? atprotoFetchUserVideoCursor : fetchUserVideoCursor)({
                queryKey: ['profileVideoFeed', profileId, id],
                pageParam,
            }),
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
        initialPageParam: null,
        enabled: !!profileId && !!id,
    });

    const videoLikeMutation = useMutation({
        mutationFn: async (data) => {
            const dir = data.type;
            const like = atproto ? atprotoVideoLike : videoLike;
            const unlike = atproto ? atprotoVideoUnlike : videoUnlike;

            if (dir == 'like') {
                return await like(data.id);
            }
            if (dir == 'unlike') {
                return await unlike(data.id);
            }
        },
        onSuccess: (res) => {},
        onError: (error) => {},
    });

    const videoBookmarkMutation = useMutation({
        mutationFn: async (data) => {
            const dir = data.type;
            const bookmark = atproto ? atprotoVideoBookmark : videoBookmark;
            const unbookmark = atproto ? atprotoVideoUnbookmark : videoUnbookmark;

            if (dir == 'bookmark') {
                return await bookmark(data.id);
            }
            if (dir == 'unbookmark') {
                return await unbookmark(data.id);
            }
        },
        onSuccess: (res) => {},
        onError: (error) => {},
    });

    const videos = useMemo(
        () => data?.pages?.flatMap((page) => page.data) ?? [],
        [data?.pages],
    );

    const targetIndex = useMemo(() => {
        const normalizedId = decodeRouteParam(id);
        const idx = videos.findIndex((v) => decodeRouteParam(v.id) === normalizedId);
        return idx >= 0 ? idx : 0;
    }, [videos, id]);

    useEffect(() => {
        hasScrolledToTarget.current = false;
        setCurrentIndex(targetIndex);
    }, [id, profileId, targetIndex]);

    useEffect(() => {
        if (hasScrolledToTarget.current || feedHeight === 0 || videos.length === 0) {
            return;
        }

        if (targetIndex <= 0) {
            hasScrolledToTarget.current = true;
            return;
        }

        hasScrolledToTarget.current = true;
        requestAnimationFrame(() => {
            flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
        });
    }, [feedHeight, videos.length, targetIndex, id, profileId]);

    useEffect(() => {
        if (!shouldOpenComments || videos.length === 0) {
            return;
        }

        const targetVideo = videos[targetIndex] ?? videos[0];
        if (!targetVideo) {
            return;
        }

        setSelectedVideo(targetVideo);
        setShowComments(true);
    }, [shouldOpenComments, videos, targetIndex]);

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const idx = viewableItems[0].index;
            setCurrentIndex(typeof idx === 'number' && Number.isFinite(idx) ? idx : 0);
        }
    }).current;

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
            const sharedProps = {
                key: item.id,
                item,
                bottomInset: insets.bottom,
                onLike: handleLike,
                onComment: handleComment,
                onShare: handleShare,
                onOther: handleOther,
                onBookmark: handleBookmark,
                tabBarHeight: 20,
                onNavigate: handleNavigate,
            };

            if (item.is_photo || item.media_type === 'photo') {
                return (
                    <View style={{ height: feedHeight }}>
                        <PhotoFeedSlide {...sharedProps} />
                    </View>
                );
            }

            return (
                <VideoPlayer
                    {...sharedProps}
                    isActive={index === currentIndex}
                    itemHeight={feedHeight}
                    commentsOpen={showComments && selectedVideo?.id === item.id}
                    shareOpen={showShare && selectedVideo?.id === item.id}
                    otherOpen={showOther && selectedVideo?.id === item.id}
                    screenFocused={screenFocused}
                    videoPlaybackRates={videoPlaybackRates}
                    navigation={navigation}
                />
            );
        },
        [
            currentIndex,
            feedHeight,
            insets.bottom,
            showComments,
            showShare,
            showOther,
            selectedVideo,
            screenFocused,
            videoPlaybackRates,
            navigation,
        ],
    );

    const handleEndReached = () => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    const showEmptyFeed = !isLoading && feedHeight > 0 && videos.length === 0;

    return (
        <View style={styles.container} onLayout={onContainerLayout}>
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.header, { top: insets.top + 10 }]}>
                <View style={styles.tabContainer} />
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={28} color="white" />
                </TouchableOpacity>
            </View>

            {isLoading || feedHeight === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            ) : showEmptyFeed ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.emptyText}>This post could not be loaded.</Text>
                    <TouchableOpacity style={styles.emptyBackButton} onPress={() => router.back()}>
                        <Text style={styles.emptyBackText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    key={`${profileId}-${id}`}
                    ref={flatListRef}
                    data={videos}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    pagingEnabled
                    showsVerticalScrollIndicator={false}
                    snapToInterval={feedHeight}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    viewabilityConfig={viewabilityConfig.current}
                    onViewableItemsChanged={onViewableItemsChanged}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    getItemLayout={(data, index) => ({
                        length: feedHeight,
                        offset: feedHeight * index,
                        index,
                    })}
                    removeClippedSubviews={false}
                    maxToRenderPerBatch={3}
                    windowSize={5}
                    initialNumToRender={Math.min(Math.max(targetIndex + 1, 1), 5)}
                    initialScrollIndex={targetIndex > 0 ? targetIndex : undefined}
                    onScrollToIndexFailed={({ index }) => {
                        setTimeout(() => {
                            flatListRef.current?.scrollToIndex({ index, animated: false });
                        }, 100);
                    }}
                    updateCellsBatchingPeriod={100}
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <View style={[styles.footer, { height: feedHeight }]}>
                                <ActivityIndicator size="large" color="#fff" />
                            </View>
                        ) : null
                    }
                />
            )}

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
    backButton: {
        position: 'absolute',
        left: 16,
    },
    footer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    emptyBackButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    emptyBackText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
});
