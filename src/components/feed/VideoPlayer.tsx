import FeedActionRail from '@/components/feed/FeedActionRail';
import LinkifiedCaption from '@/components/feed/LinkifiedCaption';
import { toProfilePath } from '@/utils/profileNavigation';
import { ANDROID_VIDEO_SAFE_MODE } from '@/utils/androidVideoSafeMode';
import { prefetchVideoUrl, takePrefetchedPlayer } from '@/utils/videoPrefetch';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

function safeCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const POSTER_BG = '#1a1a1a';

function prefetchThumbnail(url: string | undefined) {
    if (!url) {
        return;
    }
    void Image.prefetch(url);
}

function VideoPoster({ thumbnail }: { thumbnail?: string }) {
    return (
        <View style={styles.posterLayer} pointerEvents="none">
            {thumbnail ? (
                <Image
                    source={{ uri: thumbnail }}
                    style={styles.posterImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                    placeholder={{ color: POSTER_BG }}
                />
            ) : null}
        </View>
    );
}

function VideoSlidePlaceholder({ item }: { item: { media?: { thumbnail?: string; src_url?: string } } }) {
    const thumbnail = item.media?.thumbnail;

    useEffect(() => {
        prefetchThumbnail(thumbnail);
        if (ANDROID_VIDEO_SAFE_MODE) {
            return;
        }
        void prefetchVideoUrl(item.media?.src_url);
    }, [item.media?.src_url, thumbnail]);

    return (
        <View style={styles.videoContainer}>
            <View style={styles.videoWrapper}>
                <VideoPoster thumbnail={thumbnail} />
            </View>
        </View>
    );
}

export default function VideoPlayer({
    item,
    isActive,
    shouldPreload = true,
    onLike,
    onComment,
    onShare,
    onBookmark,
    onRepost,
    onOther,
    bottomInset,
    commentsOpen,
    screenFocused,
    videoPlaybackRates,
    shareOpen,
    otherOpen,
    navigation,
    onNavigate,
    tabBarHeight = 60,
    overlayBottom,
    actionRailBottom,
}) {
    if (!isActive && !shouldPreload) {
        return <VideoSlidePlaceholder item={item} />;
    }

    return (
        <VideoPlayerCore
            item={item}
            isActive={isActive}
            onLike={onLike}
            onComment={onComment}
            onShare={onShare}
            onBookmark={onBookmark}
            onRepost={onRepost}
            onOther={onOther}
            bottomInset={bottomInset}
            commentsOpen={commentsOpen}
            screenFocused={screenFocused}
            videoPlaybackRates={videoPlaybackRates}
            shareOpen={shareOpen}
            otherOpen={otherOpen}
            navigation={navigation}
            onNavigate={onNavigate}
            tabBarHeight={tabBarHeight}
            overlayBottom={overlayBottom}
            actionRailBottom={actionRailBottom}
        />
    );
}

function VideoPlayerCore({
    item,
    isActive,
    onLike,
    onComment,
    onShare,
    onBookmark,
    onRepost,
    onOther,
    bottomInset,
    commentsOpen,
    screenFocused,
    videoPlaybackRates,
    shareOpen,
    otherOpen,
    navigation,
    onNavigate,
    tabBarHeight = 60,
    overlayBottom,
    actionRailBottom,
}) {
    const [isLiked, setIsLiked] = useState(item.has_liked);
    const [isBookmarked, setIsBookmarked] = useState(item.has_bookmarked);
    const [isReposted, setIsReposted] = useState(!!item.has_reposted);
    const [showControls, setShowControls] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const manualControlRef = useRef(false);
    const isMountedRef = useRef(true);
    const wasActiveRef = useRef(false);
    const router = useRouter();
    const [playSensitive, setPlaySensitive] = useState(false);
    const controlsTimeoutRef = useRef(null);
    const captionBottom = overlayBottom ?? bottomInset + tabBarHeight + 10;

    const playbackRate = videoPlaybackRates[item.id] || 1.0;

    const srcUrl = item.media?.src_url;
    const thumbnail = item.media?.thumbnail;
    const playerRef = useRef<ReturnType<typeof createVideoPlayer> | null>(null);
    if (!playerRef.current && srcUrl) {
        playerRef.current =
            takePrefetchedPlayer(srcUrl) ?? createVideoPlayer(srcUrl);
    }
    const player = playerRef.current;

    useEffect(() => {
        setVideoReady(false);
        prefetchThumbnail(thumbnail);
    }, [srcUrl, thumbnail]);

    useEventListener(player, 'statusChange', ({ status }) => {
        if (status === 'readyToPlay' && isMountedRef.current) {
            setVideoReady(true);
        }
    });

    useEffect(() => {
        isMountedRef.current = true;
        if (player) {
            player.loop = true;
        }
        return () => {
            isMountedRef.current = false;
            try {
                playerRef.current?.release?.();
            } catch {
                // already released
            }
            playerRef.current = null;
        };
    }, [player]);

    useEffect(() => {
        if (!player) return;
        try {
            player.playbackRate = playbackRate;
        } catch (error) {
            console.log('Playback rate error:', error);
        }
    }, [playbackRate, player]);

    useEffect(() => {
        if (!player) return;

        try {
            if (manualControlRef.current) {
                return;
            }

            const shouldPlay = isActive && screenFocused && !(item.is_sensitive && !playSensitive);

            if (isActive && !wasActiveRef.current) {
                player.currentTime = 0;
            }

            if (shouldPlay && isMountedRef.current) {
                player.play();
                setIsPlaying(true);
            } else if (isMountedRef.current) {
                player.pause();
                setIsPlaying(false);
            }

            wasActiveRef.current = isActive;
        } catch (error) {
            console.log('Player control error:', error);
        }
    }, [
        isActive,
        commentsOpen,
        shareOpen,
        otherOpen,
        screenFocused,
        player,
        item.is_sensitive,
        playSensitive,
    ]);

    useEffect(() => {
        if (ANDROID_VIDEO_SAFE_MODE) {
            return;
        }
        const url = item.media?.src_url;
        if (!url || isActive) {
            return;
        }
        void prefetchVideoUrl(url);
    }, [item.media?.src_url, isActive]);

    useEffect(() => {
        if (!isActive) {
            manualControlRef.current = false;
            setPlaySensitive(false);
        }
    }, [isActive]);

    const handleLike = () => {
        setIsLiked(!isLiked);
        onLike(item.id, !isLiked);
    };

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
        onBookmark(item.id, !isBookmarked);
    };

    const handleRepost = () => {
        setIsReposted(!isReposted);
        onRepost(item.id, !isReposted);
    };

    const togglePlayPause = () => {
        if (!player || !isMountedRef.current) return;

        try {
            manualControlRef.current = true;

            if (isPlaying) {
                player.pause();
                setIsPlaying(false);
            } else {
                player.play();
                setIsPlaying(true);
            }
        } catch (error) {
            console.log('Toggle play/pause error:', error);
        }
    };

    const handleScreenPress = () => {
        if (!isMountedRef.current) {
            return;
        }

        const newShowControls = !showControls;
        setShowControls(newShowControls);

        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }

        if (newShowControls) {
            controlsTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    setShowControls(false);
                    manualControlRef.current = false;
                }
            }, 3000);
        } else {
            manualControlRef.current = false;
        }
    };

    useEffect(() => {
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, []);

    const handleViewSensitiveContent = () => {
        setPlaySensitive(true);
    };

    const likeCount =
        safeCount(item.likes) + (isLiked && !item.has_liked ? 1 : 0);
    const bookmarkCount =
        safeCount(item.bookmarks) + (isBookmarked && !item.has_bookmarked ? 1 : 0);
    const repostCount =
        safeCount(item.shares) +
        (isReposted && !item.has_reposted ? 1 : 0) -
        (!isReposted && item.has_reposted ? 1 : 0);

    if (!player) {
        return <VideoSlidePlaceholder item={item} />;
    }

    if (item.is_sensitive && !playSensitive) {
        return (
            <View style={styles.videoContainer}>
                <View
                    style={styles.sensitiveOverlay}
                    accessible={true}
                    accessibilityLabel="Sensitive content warning. This video may contain sensitive content."
                    accessibilityRole="alert">
                    <View style={styles.sensitiveContent}>
                        <View style={styles.sensitiveIconWrapper}>
                            <Ionicons name="eye-off-outline" size={48} color="white" />
                        </View>
                        <Text style={styles.sensitiveTitle}>Sensitive Content</Text>
                        <Text style={styles.sensitiveDescription}>
                            This video may contain sensitive content
                        </Text>
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.viewButton}
                                onPress={handleViewSensitiveContent}
                                activeOpacity={0.8}
                                accessible={true}
                                accessibilityLabel="Watch video anyway"
                                accessibilityRole="button"
                                accessibilityHint="Dismisses the sensitive content warning and plays the video">
                                <Text style={styles.viewButtonText}>Watch anyways</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    const hidePoster = videoReady && isActive;

    return (
        <View style={styles.videoContainer}>
            <View style={styles.videoWrapper}>
                {!hidePoster ? <VideoPoster thumbnail={thumbnail} /> : null}
                <VideoView
                    style={[styles.video, !hidePoster && styles.videoHiddenUntilReady]}
                    player={player}
                    allowsPictureInPicture={false}
                    nativeControls={false}
                    accessible={true}
                    accessibilityLabel={item.media.alt_text || 'Video content'}
                    accessibilityHint="Tap to show playback controls"
                    contentFit="contain"
                />

                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => handleScreenPress()}
                    disabled={showControls}
                    accessible={true}
                    accessibilityLabel="Video"
                    accessibilityHint="Tap to show playback controls"
                    accessibilityRole="button"
                />

                {showControls && (
                    <View style={styles.controlsOverlay} pointerEvents="box-none">
                        <TouchableOpacity
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                togglePlayPause();
                            }}
                            style={styles.playButton}
                            activeOpacity={0.7}
                            accessible={true}
                            accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isPlaying }}>
                            <Ionicons name={isPlaying ? 'pause' : 'play'} size={60} color="white" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
                style={styles.gradientOverlay}
                pointerEvents="none"
            />

            <FeedActionRail
                avatarUrl={item.account?.avatar}
                profileLabel={`View ${item.account.username}'s profile`}
                isLiked={isLiked}
                isBookmarked={isBookmarked}
                isReposted={isReposted}
                likeCount={likeCount}
                commentCount={safeCount(item.comments)}
                bookmarkCount={bookmarkCount}
                repostCount={repostCount}
                canComment={item.permissions?.can_comment}
                bottomInset={bottomInset}
                tabBarHeight={tabBarHeight}
                overlayBottom={actionRailBottom ?? overlayBottom}
                onProfilePress={() => router.push(toProfilePath(item.account.id))}
                onLike={handleLike}
                onComment={() => onComment(item)}
                onBookmark={handleBookmark}
                onRepost={handleRepost}
                onShare={() => onShare(item)}
                onOther={() => onOther(item)}
            />

            <View style={[styles.bottomInfo, { bottom: captionBottom }]}>
                <TouchableOpacity
                    onPress={() => {
                        onNavigate?.();
                        router.push(toProfilePath(item.account.id));
                    }}
                    accessible={true}
                    accessibilityLabel={`View @${item.account.username}'s profile`}
                    accessibilityRole="link">
                    <Text style={styles.username}>@{item.account.username}</Text>
                </TouchableOpacity>
                {item.caption && (
                    <LinkifiedCaption
                        caption={item.caption}
                        tags={item.tags || []}
                        mentions={item.mentions || []}
                        style={styles.caption}
                        numberOfLines={1}
                        onHashtagPress={(tag) => {
                            onNavigate?.();
                            router.push(`/private/search?query=${tag}`);
                        }}
                        onMentionPress={(username, profileId) => {
                            onNavigate?.();
                            const target = profileId ?? username;
                            if (!target) return;
                            router.push(toProfilePath(target));
                        }}
                        onMorePress={() => onComment(item)}
                    />
                )}

                {item?.meta?.contains_ai && (
                    <View>
                        <View
                            style={styles.aiLabelWrapper}
                            accessible={true}
                            accessibilityLabel="Creator labeled this as AI-generated content"
                            accessibilityRole="text">
                            <Text style={styles.aiLabelText}>Creator labeled as AI-generated</Text>
                        </View>
                    </View>
                )}

                <View
                    style={styles.audioInfo}
                    accessible={true}
                    accessibilityLabel="Original Audio"
                    accessibilityRole="text">
                    <Ionicons
                        name="musical-notes"
                        size={14}
                        color="white"
                        importantForAccessibility="no"
                    />
                    <Text style={styles.audioText}>Original Audio</Text>
                </View>

                {item?.meta?.contains_ad && (
                    <View>
                        <View
                            style={styles.aiLabelWrapper}
                            accessible={true}
                            accessibilityLabel="Sponsored content"
                            accessibilityRole="text">
                            <Text style={styles.aiLabelText}>Sponsored</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    videoContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        position: 'relative',
    },
    videoWrapper: {
        flex: 1,
        backgroundColor: POSTER_BG,
    },
    posterLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: POSTER_BG,
        zIndex: 0,
    },
    posterImage: {
        width: '100%',
        height: '100%',
    },
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        zIndex: 1,
    },
    videoHiddenUntilReady: {
        opacity: 0,
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 10,
        elevation: 10,
    },
    playButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 11,
        elevation: 11,
    },
    sensitiveOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.99)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 15,
        elevation: 15,
    },
    sensitiveContent: {
        alignItems: 'center',
        paddingHorizontal: 40,
        width: '100%',
    },
    sensitiveIconWrapper: {
        padding: 20,
        borderRadius: 90,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    sensitiveTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
    },
    sensitiveDescription: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonContainer: {
        width: '100%',
    },
    viewButton: {
        backgroundColor: 'white',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    viewButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    bottomInfo: {
        position: 'absolute',
        left: 12,
        right: 80,
    },
    username: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    caption: {
        color: 'white',
        fontSize: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    audioInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        opacity: 0.6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    audioText: {
        color: 'white',
        fontSize: 14,
    },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '20%',
    },
    aiLabelWrapper: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        marginVertical: 6,
        alignSelf: 'flex-start',
    },
    aiLabelText: {
        color: '#ffffff',
        fontWeight: 500,
    },
});
