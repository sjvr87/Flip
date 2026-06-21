import CommentsModal from '@/components/feed/CommentsModal';
import OtherModal from '@/components/feed/OtherModal';
import PhotoFeedSlide from '@/components/feed/PhotoFeedSlide';
import ShareModal from '@/components/feed/ShareModal';
import VideoPlayer from '@/components/feed/VideoPlayer';
import {
    fetchPostForViewer,
    videoBookmark as atprotoVideoBookmark,
    videoLike as atprotoVideoLike,
    videoUnbookmark as atprotoVideoUnbookmark,
    videoUnlike as atprotoVideoUnlike,
} from '@/atproto';
import {
    decodeRouteParam,
    parseRepoDidFromAtUri,
    postAtUriToBskyUrl,
    toProfilePath,
} from '@/utils/profileNavigation';
import { FeedScrollGestureRoot } from '@/utils/feedScrollGesture';
import {
    usesAtprotoBackend,
    videoBookmark,
    videoLike,
    videoUnbookmark,
    videoUnlike,
} from '@/utils/requests';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PostViewScreen({ navigation }) {
    const params = useLocalSearchParams();
    const uri = decodeRouteParam(params.uri);
    const shouldOpenComments =
        params.openComments === '1' || params.openComments === 'true';
    const atproto = usesAtprotoBackend();

    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [showComments, setShowComments] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [videoPlaybackRates, setVideoPlaybackRates] = useState({});
    const [screenFocused, setScreenFocused] = useState(true);
    const [feedHeight, setFeedHeight] = useState(0);
    const openedComments = useRef(false);

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

    const { data: video, isLoading, isError, refetch } = useQuery({
        queryKey: ['postViewer', uri],
        queryFn: () => fetchPostForViewer(uri),
        enabled: !!uri && atproto,
        staleTime: 0,
    });

    const videoLikeMutation = useMutation({
        mutationFn: async (data) => {
            const like = atproto ? atprotoVideoLike : videoLike;
            const unlike = atproto ? atprotoVideoUnlike : videoUnlike;
            if (data.type === 'like') return await like(data.id);
            if (data.type === 'unlike') return await unlike(data.id);
        },
    });

    const videoBookmarkMutation = useMutation({
        mutationFn: async (data) => {
            const bookmark = atproto ? atprotoVideoBookmark : videoBookmark;
            const unbookmark = atproto ? atprotoVideoUnbookmark : videoUnbookmark;
            if (data.type === 'bookmark') return await bookmark(data.id);
            if (data.type === 'unbookmark') return await unbookmark(data.id);
        },
    });

    useEffect(() => {
        openedComments.current = false;
    }, [uri]);

    useEffect(() => {
        if (!shouldOpenComments || !video || openedComments.current) {
            return;
        }
        openedComments.current = true;
        setSelectedVideo(video);
        setShowComments(true);
    }, [shouldOpenComments, video]);

    const handleLike = (videoId, liked) => {
        videoLikeMutation.mutate({ type: liked ? 'like' : 'unlike', id: videoId });
    };

    const handleBookmark = (videoId, bookmarked) => {
        videoBookmarkMutation.mutate({
            type: bookmarked ? 'bookmark' : 'unbookmark',
            id: videoId,
        });
    };

    const handleComment = (item) => {
        setSelectedVideo(item);
        setShowComments(true);
    };

    const handleShare = (item) => {
        setSelectedVideo(item);
        setShowShare(true);
    };

    const handleOther = (item) => {
        setSelectedVideo(item);
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

    const profileId = video?.account?.id || parseRepoDidFromAtUri(uri);
    const bskyPostUrl = postAtUriToBskyUrl(uri);
    const showEmpty = !isLoading && feedHeight > 0 && !video;

    const handleOpenOnBsky = () => {
        if (bskyPostUrl) {
            Linking.openURL(bskyPostUrl);
            return;
        }
        if (profileId) {
            router.push(toProfilePath(profileId));
        }
    };

    const sharedProps = video
        ? {
              item: video,
              bottomInset: insets.bottom,
              onLike: handleLike,
              onComment: handleComment,
              onShare: handleShare,
              onOther: handleOther,
              onBookmark: handleBookmark,
              tabBarHeight: 20,
              onNavigate: handleNavigate,
          }
        : null;

    return (
        <View style={styles.container} onLayout={onContainerLayout}>
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.header, { top: insets.top + 10 }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={28} color="white" />
                </TouchableOpacity>
            </View>

            {isLoading || feedHeight === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            ) : showEmpty ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>
                        {bskyPostUrl
                            ? 'This post is text-only or could not be shown in the video feed.'
                            : 'This post could not be loaded.'}
                    </Text>
                    {bskyPostUrl ? (
                        <TouchableOpacity style={styles.emptyButton} onPress={handleOpenOnBsky}>
                            <Text style={styles.emptyButtonText}>View on Bluesky</Text>
                        </TouchableOpacity>
                    ) : null}
                    {profileId ? (
                        <TouchableOpacity
                            style={[styles.emptyButton, bskyPostUrl ? styles.emptySecondary : null]}
                            onPress={() => router.push(toProfilePath(profileId))}>
                            <Text style={styles.emptyButtonText}>View profile</Text>
                        </TouchableOpacity>
                    ) : null}
                    {isError ? (
                        <TouchableOpacity style={[styles.emptyButton, styles.emptySecondary]} onPress={() => refetch()}>
                            <Text style={styles.emptyButtonText}>Retry</Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={[styles.emptyButton, styles.emptySecondary]}
                        onPress={() => router.back()}>
                        <Text style={styles.emptyButtonText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            ) : sharedProps ? (
                <FeedScrollGestureRoot>
                    <View style={{ height: feedHeight }}>
                        {video.is_photo || video.media_type === 'photo' ? (
                            <PhotoFeedSlide {...sharedProps} />
                        ) : (
                            <VideoPlayer
                                {...sharedProps}
                                isActive
                                itemHeight={feedHeight}
                                commentsOpen={showComments}
                                shareOpen={showShare}
                                otherOpen={showOther}
                                screenFocused={screenFocused}
                                videoPlaybackRates={videoPlaybackRates}
                                navigation={navigation}
                            />
                        )}
                    </View>
                </FeedScrollGestureRoot>
            ) : null}

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
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10,
        paddingHorizontal: 16,
    },
    backButton: {
        alignSelf: 'flex-start',
    },
    emptyText: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    emptyButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginBottom: 10,
    },
    emptySecondary: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
});
