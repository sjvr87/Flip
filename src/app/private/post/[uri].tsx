import CommentsModal from '@/components/feed/CommentsModal';
import CaptionExpandModal from '@/components/feed/CaptionExpandModal';
import OtherModal from '@/components/feed/OtherModal';
import PhotoFeedSlide from '@/components/feed/PhotoFeedSlide';
import ShareModal from '@/components/feed/ShareModal';
import TextPostSlide from '@/components/feed/TextPostSlide';
import VideoPlayer from '@/components/feed/VideoPlayer';
import type { FlipTextPost, FlipVideo } from '@/atproto/types';
import {
    fetchPostForViewer,
    videoBookmark as atprotoVideoBookmark,
    videoLike as atprotoVideoLike,
    videoRepost as atprotoVideoRepost,
    videoUnbookmark as atprotoVideoUnbookmark,
    videoUnlike as atprotoVideoUnlike,
    videoUnrepost as atprotoVideoUnrepost,
} from '@/atproto';
import {
    decodeRouteParam,
    parseRepoDidFromAtUri,
    postAtUriToBskyUrl,
    toProfilePath,
} from '@/utils/profileNavigation';
import { findCachedProfileMedia } from '@/utils/feedCache';
import { patchExploreTextPostLike } from '@/utils/exploreCache';
import { FeedScrollGestureRoot } from '@/utils/feedScrollGesture';
import {
    usesAtprotoBackend,
    videoBookmark,
    videoLike,
    videoUnbookmark,
    videoUnlike,
} from '@/utils/requests';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    const queryClient = useQueryClient();
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [showComments, setShowComments] = useState(false);
    const [showCaptionExpand, setShowCaptionExpand] = useState(false);
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

    const { data: postContent, isLoading, isError, refetch } = useQuery({
        queryKey: ['postViewer', uri],
        queryFn: async () => {
            const fetched = await fetchPostForViewer(uri);
            if (fetched) return fetched;
            return findCachedProfileMedia(queryClient, uri);
        },
        enabled: !!uri && atproto,
        staleTime: 0,
    });

    const video = postContent && 'media' in postContent ? (postContent as FlipVideo) : null;
    const textPost = postContent && 'text' in postContent ? (postContent as FlipTextPost) : null;

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

    const videoRepostMutation = useMutation({
        mutationFn: async (data) => {
            if (!atproto) return;
            if (data.type === 'repost') return await atprotoVideoRepost(data.id);
            if (data.type === 'unrepost') return await atprotoVideoUnrepost(data.id);
        },
        onError: (error) => {
            console.warn('[postViewer] repost failed:', error);
        },
    });

    useEffect(() => {
        openedComments.current = false;
    }, [uri]);

    useEffect(() => {
        if (!shouldOpenComments || !postContent || openedComments.current) {
            return;
        }
        openedComments.current = true;
        setSelectedVideo(postContent as FlipVideo);
        setShowComments(true);
    }, [shouldOpenComments, postContent]);

    const handleLike = (videoId, liked) => {
        patchExploreTextPostLike(queryClient, videoId, liked);
        videoLikeMutation.mutate(
            { type: liked ? 'like' : 'unlike', id: videoId },
            {
                onError: () => {
                    patchExploreTextPostLike(queryClient, videoId, !liked);
                },
                onSuccess: (result) => {
                    if (result) {
                        patchExploreTextPostLike(queryClient, videoId, result.has_liked, result.likes);
                    }
                },
            },
        );
    };

    const handleBookmark = (videoId, bookmarked) => {
        videoBookmarkMutation.mutate({
            type: bookmarked ? 'bookmark' : 'unbookmark',
            id: videoId,
        });
    };

    const handleRepost = (postId, reposted) => {
        videoRepostMutation.mutate({
            type: reposted ? 'repost' : 'unrepost',
            id: postId,
        });
    };

    const handleComment = (item) => {
        setSelectedVideo(item);
        setShowComments(true);
    };

    const handleCaptionExpand = (item) => {
        setSelectedVideo(item);
        setShowCaptionExpand(true);
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
        setShowCaptionExpand(false);
        setShowShare(false);
        setShowOther(false);
    };

    const profileId = postContent?.account?.id || parseRepoDidFromAtUri(uri);
    const bskyPostUrl = postAtUriToBskyUrl(uri);
    const showEmpty = !isLoading && feedHeight > 0 && !postContent;

    const handleOpenOnBsky = () => {
        if (bskyPostUrl) {
            Linking.openURL(bskyPostUrl);
            return;
        }
        if (profileId) {
            router.push(toProfilePath(profileId));
        }
    };

    const sharedVideoProps = video
        ? {
              item: video,
              bottomInset: insets.bottom,
              onLike: handleLike,
              onComment: handleComment,
              onCaptionExpand: handleCaptionExpand,
              onShare: handleShare,
              onOther: handleOther,
              onBookmark: handleBookmark,
              onRepost: handleRepost,
              tabBarHeight: 20,
              onNavigate: handleNavigate,
          }
        : null;

    const sharedTextProps = textPost
        ? {
              item: textPost,
              bottomInset: insets.bottom,
              onLike: handleLike,
              onComment: handleComment,
              onCaptionExpand: handleCaptionExpand,
              onShare: handleShare,
              onBookmark: handleBookmark,
              onRepost: handleRepost,
              onOther: handleOther,
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
            ) : sharedVideoProps ? (
                <FeedScrollGestureRoot>
                    <View style={{ height: feedHeight }}>
                        {video.is_photo || video.media_type === 'photo' ? (
                            <PhotoFeedSlide {...sharedVideoProps} />
                        ) : (
                            <VideoPlayer
                                {...sharedVideoProps}
                                isActive
                                standalonePlayback
                                feedHeight={feedHeight}
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
            ) : sharedTextProps ? (
                <View style={{ height: feedHeight }}>
                    <TextPostSlide {...sharedTextProps} />
                </View>
            ) : null}

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
