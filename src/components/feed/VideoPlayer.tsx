import MentionText from '@/components/MentionText';
import FeedActionRail from '@/components/feed/FeedActionRail';
import LinkifiedCaption from '@/components/feed/LinkifiedCaption';
import { toProfilePath } from '@/utils/profileNavigation';
import { safeRouterPush } from '@/utils/safeNavigation';
import { ANDROID_VIDEO_SAFE_MODE, feedPlayerReleaseDelayMs } from '@/utils/androidVideoSafeMode';
import { audioAttributionLabel, isOriginalAudio } from '@/utils/audioAttribution';
import { prepareForCameraCapture } from '@/utils/cameraCapturePrepare';
import {
    claimFeedAudio,
    isFeedPlaybackActive,
    registerFeedPlayer,
    releaseFeedAudio,
    subscribeFeedPlaybackActive,
    subscribePlaybackGeneration,
} from '@/utils/feedPlaybackGuard';
import {
    getFeedNetworkProfile,
    reportFeedPlaybackStall,
    subscribeFeedNetworkProfile,
    type FeedNetworkProfile,
} from '@/utils/feedNetworkQuality';
import { useFeedPlaybackStore } from '@/utils/feedPlaybackStore';
import { usePendingAudioReuseStore } from '@/utils/pendingAudioReuseStore';
import { canUseFlipCamera } from '@/utils/runtime';
import { buildFeedVideoSource } from '@/utils/feedVideoSource';
import { prefetchThumbnails } from '@/utils/thumbnailPrefetch';
import { prefetchVideoUrl, takePrefetchedPlayer } from '@/utils/videoPrefetch';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    InteractionManager,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

/** Tap overlay stops here so the right action rail stays visible and tappable. */
const ACTION_RAIL_WIDTH = 72;

function safeCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const POSTER_BG = '#000';

type ExpoVideoPlayer = ReturnType<typeof createVideoPlayer>;

function isPlayerUsable(player: ExpoVideoPlayer | null | undefined): player is ExpoVideoPlayer {
    if (!player) {
        return false;
    }
    try {
        // Touch native shared object — throws after release.
        void player.status;
        return typeof player.addListener === 'function';
    } catch {
        return false;
    }
}

function VideoPoster({ thumbnail }: { thumbnail?: string }) {
    return (
        <View style={styles.posterLayer} pointerEvents="none">
            {thumbnail ? (
                <Image
                    source={{ uri: thumbnail }}
                    style={styles.posterImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    placeholder={{ color: POSTER_BG }}
                />
            ) : null}
        </View>
    );
}

function VideoSlidePlaceholder({
    item,
    feedHeight,
    videoTopInset = 0,
    videoBottomReserved = 0,
}: {
    item: { media?: { thumbnail?: string; src_url?: string } };
    feedHeight?: number;
    videoTopInset?: number;
    videoBottomReserved?: number;
}) {
    const thumbnail = item.media?.thumbnail;
    const slideHeight = feedHeight ?? SCREEN_HEIGHT;
    const videoBandStyle =
        videoTopInset === 0 && videoBottomReserved === 0
            ? { top: 0, left: 0, right: 0, height: slideHeight }
            : { top: videoTopInset, bottom: videoBottomReserved };

    useEffect(() => {
        prefetchThumbnails([thumbnail]);
        if (ANDROID_VIDEO_SAFE_MODE || !isFeedPlaybackActive()) {
            return;
        }
        void prefetchVideoUrl(item.media?.src_url);
    }, [item.media?.src_url, thumbnail]);

    return (
        <View style={[styles.videoContainer, { height: slideHeight }]}>
            <View style={[styles.videoWrapper, videoBandStyle]}>
                <VideoPoster thumbnail={thumbnail} />
            </View>
        </View>
    );
}

function VideoPlayer({
    item,
    isActive,
    shouldPreload = true,
    standalonePlayback = false,
    feedHeight,
    videoTopInset = 0,
    videoBottomReserved = 0,
    onLike,
    onComment,
    onCaptionExpand,
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
    const wantsPlayer = isActive || shouldPreload;
    const [holdPlayer, setHoldPlayer] = useState(wantsPlayer);

    useEffect(() => {
        if (wantsPlayer) {
            setHoldPlayer(true);
            return;
        }
        const timer = setTimeout(() => setHoldPlayer(false), feedPlayerReleaseDelayMs);
        return () => clearTimeout(timer);
    }, [wantsPlayer]);

    if (!holdPlayer) {
        return (
            <VideoSlidePlaceholder
                item={item}
                feedHeight={feedHeight}
                videoTopInset={videoTopInset}
                videoBottomReserved={videoBottomReserved}
            />
        );
    }

    return (
        <VideoPlayerCore
            item={item}
            isActive={isActive}
            standalonePlayback={standalonePlayback}
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

export default React.memo(VideoPlayer);

function VideoPlayerCore({
    item,
    isActive,
    standalonePlayback = false,
    feedHeight,
    videoTopInset = 0,
    videoBottomReserved = 0,
    onLike,
    onComment,
    onCaptionExpand,
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
    const [isPlaying, setIsPlaying] = useState(false);
    const isMountedRef = useRef(true);
    const wasActiveRef = useRef(false);
    const everActiveRef = useRef(false);
    const router = useRouter();
    const feedMuted = useFeedPlaybackStore((s) => s.feedMuted);
    const toggleFeedMuted = useFeedPlaybackStore((s) => s.toggleFeedMuted);
    const isManuallyPaused = useFeedPlaybackStore((s) => s.isManuallyPaused(item.id));
    const setManuallyPaused = useFeedPlaybackStore((s) => s.setManuallyPaused);
    const setPendingAudioReuse = usePendingAudioReuseStore((s) => s.setPending);
    const [playSensitive, setPlaySensitive] = useState(false);
    const slideHeight = feedHeight ?? SCREEN_HEIGHT;
    const videoBandStyle =
        videoTopInset === 0 && videoBottomReserved === 0
            ? { top: 0, left: 0, right: 0, height: slideHeight }
            : { top: videoTopInset, bottom: videoBottomReserved };
    const captionBottom = overlayBottom ?? bottomInset + tabBarHeight + 10;
    const feedGradientBottom = bottomInset + tabBarHeight;
    const audioLabel = audioAttributionLabel(item);
    const showRemixedAudio = !isOriginalAudio(item);
    const canUseAudio = !!item.permissions?.can_use_audio && !item.is_photo;

    const playbackRate = videoPlaybackRates[item.id] || 1.0;

    const srcUrl = item.media?.src_url;
    const thumbnail = item.media?.thumbnail;
    const playerRef = useRef<ExpoVideoPlayer | null>(null);
    const boundSrcRef = useRef<string | undefined>(undefined);
    const pendingReleaseRef = useRef<ExpoVideoPlayer[]>([]);
    const playerEpochRef = useRef(0);
    const [player, setPlayer] = useState<ExpoVideoPlayer | null>(null);
    const [playerEpoch, setPlayerEpoch] = useState(0);
    const [viewPlayer, setViewPlayer] = useState<ExpoVideoPlayer | null>(null);
    const [viewEpoch, setViewEpoch] = useState(0);
    const [videoReady, setVideoReady] = useState(false);
    const [firstFrameRendered, setFirstFrameRendered] = useState(false);
    const [playerStatus, setPlayerStatus] = useState<string>('idle');
    const [networkProfile, setNetworkProfile] = useState<FeedNetworkProfile>(() =>
        getFeedNetworkProfile(),
    );
    const stallTimestampsRef = useRef<number[]>([]);
    const [playbackAllowed, setPlaybackAllowed] = useState(
        () => standalonePlayback || isFeedPlaybackActive(),
    );

    useEffect(() => {
        if (standalonePlayback) {
            return;
        }
        return subscribeFeedPlaybackActive(setPlaybackAllowed);
    }, [standalonePlayback]);

    useEffect(() => subscribeFeedNetworkProfile(setNetworkProfile), []);

    const queuePlayerRelease = useCallback((released: ExpoVideoPlayer) => {
        try {
            released.pause?.();
            released.muted = true;
        } catch {
            // player may already be released
        }
        pendingReleaseRef.current.push(released);
    }, []);

    const releasePlayerNow = useCallback((released: ExpoVideoPlayer | null | undefined) => {
        if (!released) {
            return;
        }
        try {
            released.pause?.();
            released.muted = true;
        } catch {
            // already released
        }
        try {
            released.release?.();
        } catch {
            // already released
        }
    }, []);

    useEffect(() => {
        if (!isPlayerUsable(player) || playerEpoch === 0 || playerRef.current !== player) {
            setViewPlayer(null);
            setViewEpoch(0);
            return;
        }
        setViewPlayer(player);
        setViewEpoch(playerEpoch);
        return () => {
            setViewPlayer(null);
            setViewEpoch(0);
        };
    }, [player, playerEpoch]);

    useEffect(() => {
        if (viewPlayer) {
            return;
        }
        const pending = pendingReleaseRef.current.splice(0);
        if (pending.length === 0) {
            return;
        }
        let cancelled = false;
        const outer = requestAnimationFrame(() => {
            const inner = requestAnimationFrame(() => {
                if (cancelled) {
                    return;
                }
                for (const released of pending) {
                    try {
                        released.pause?.();
                        released.muted = true;
                    } catch {
                        // already released
                    }
                    try {
                        released.release?.();
                    } catch {
                        // already released
                    }
                }
            });
            if (cancelled) {
                cancelAnimationFrame(inner);
            }
        });
        return () => {
            cancelled = true;
            cancelAnimationFrame(outer);
            pendingReleaseRef.current.push(...pending);
        };
    }, [viewPlayer]);

    useEffect(() => {
        if (!srcUrl) {
            const stale = playerRef.current;
            playerRef.current = null;
            boundSrcRef.current = undefined;
            setPlayer(null);
            setPlayerEpoch(0);
            setVideoReady(false);
            setFirstFrameRendered(false);
            setPlayerStatus('idle');
            if (stale) {
                queuePlayerRelease(stale);
            }
            return;
        }

        if (!standalonePlayback && !playbackAllowed) {
            const stale = playerRef.current;
            if (!stale) {
                return;
            }
            playerRef.current = null;
            boundSrcRef.current = undefined;
            setPlayer(null);
            setPlayerEpoch(0);
            setViewPlayer(null);
            setViewEpoch(0);
            setVideoReady(false);
            setFirstFrameRendered(false);
            setPlayerStatus('idle');
            setIsPlaying(false);
            releasePlayerNow(stale);
            return;
        }

        if (boundSrcRef.current === srcUrl && isPlayerUsable(playerRef.current)) {
            return;
        }

        const stale = playerRef.current;
        playerRef.current = null;
        boundSrcRef.current = undefined;
        setPlayer(null);
        setPlayerEpoch(0);
        setVideoReady(false);
        setFirstFrameRendered(false);
        setPlayerStatus('idle');
        if (stale) {
            queuePlayerRelease(stale);
        }

        const source = buildFeedVideoSource(srcUrl);
        if (!source) {
            return;
        }

        const nextPlayer = takePrefetchedPlayer(srcUrl) ?? createVideoPlayer(source);
        if (!isPlayerUsable(nextPlayer)) {
            return;
        }

        const epoch = playerEpochRef.current + 1;
        playerEpochRef.current = epoch;
        nextPlayer.loop = true;
        try {
            nextPlayer.bufferOptions = networkProfile.bufferOptions;
        } catch {
            // non-fatal
        }
        playerRef.current = nextPlayer;
        boundSrcRef.current = srcUrl;
        setPlayer(nextPlayer);
        setPlayerEpoch(epoch);
        setVideoReady(nextPlayer.status === 'readyToPlay');
        setFirstFrameRendered(false);
        setPlayerStatus(nextPlayer.status);

        return () => {
            if (playerRef.current === nextPlayer) {
                playerRef.current = null;
                boundSrcRef.current = undefined;
            }
            if (!standalonePlayback && !isFeedPlaybackActive()) {
                releasePlayerNow(nextPlayer);
            } else {
                queuePlayerRelease(nextPlayer);
            }
            if (isMountedRef.current) {
                setPlayer(null);
                setPlayerEpoch(0);
            }
        };
    }, [
        srcUrl,
        playbackAllowed,
        standalonePlayback,
        queuePlayerRelease,
        releasePlayerNow,
        networkProfile.bufferOptions,
    ]);

    const pauseThisPlayer = useCallback(() => {
        const activePlayer = playerRef.current;
        if (!isPlayerUsable(activePlayer)) {
            return;
        }
        try {
            activePlayer.pause();
            activePlayer.muted = true;
            if (isMountedRef.current) {
                setIsPlaying(false);
            }
        } catch {
            // player may already be released
        }
    }, []);

    const releaseThisPlayer = useCallback(() => {
        const activePlayer = playerRef.current;
        playerRef.current = null;
        boundSrcRef.current = undefined;
        if (isMountedRef.current) {
            setPlayer(null);
            setPlayerEpoch(0);
            setViewPlayer(null);
            setViewEpoch(0);
            setVideoReady(false);
            setFirstFrameRendered(false);
            setPlayerStatus('idle');
            setIsPlaying(false);
        }
        if (activePlayer) {
            try {
                activePlayer.pause?.();
                activePlayer.muted = true;
            } catch {
                // already released
            }
            try {
                activePlayer.release?.();
            } catch {
                // already released
            }
        }
        const pending = pendingReleaseRef.current.splice(0);
        for (const released of pending) {
            try {
                released.pause?.();
                released.muted = true;
            } catch {
                // already released
            }
            try {
                released.release?.();
            } catch {
                // already released
            }
        }
    }, []);

    useEffect(() => {
        if (standalonePlayback) {
            return;
        }
        return registerFeedPlayer(item.id, pauseThisPlayer, releaseThisPlayer);
    }, [standalonePlayback, item.id, pauseThisPlayer, releaseThisPlayer]);

    useEffect(() => {
        if (standalonePlayback) {
            return;
        }
        return subscribePlaybackGeneration(() => {
            pauseThisPlayer();
            releaseFeedAudio(item.id);
        });
    }, [standalonePlayback, item.id, pauseThisPlayer]);

    useEffect(() => {
        return () => {
            if (standalonePlayback) {
                return;
            }
            releaseFeedAudio(item.id);
            releaseThisPlayer();
        };
    }, [standalonePlayback, item.id, releaseThisPlayer]);

    useEffect(() => {
        if (!player) {
            return;
        }
        try {
            player.bufferOptions = networkProfile.bufferOptions;
        } catch {
            // non-fatal
        }
    }, [player, networkProfile.bufferOptions]);

    useEffect(() => {
        prefetchThumbnails([thumbnail]);
    }, [thumbnail]);

    useEffect(() => {
        if (!isPlayerUsable(player)) {
            return;
        }

        const onStatus = ({ status }: { status: string }) => {
            if (!isMountedRef.current || playerRef.current !== player) {
                return;
            }
            setPlayerStatus(status);
            if (status === 'readyToPlay') {
                setVideoReady(true);
            }
            if (status === 'loading' && isActive && isPlaying) {
                const now = Date.now();
                const recent = stallTimestampsRef.current.filter((t) => now - t < 20_000);
                recent.push(now);
                stallTimestampsRef.current = recent;
                if (recent.length >= 3) {
                    stallTimestampsRef.current = [];
                    reportFeedPlaybackStall();
                }
            }
        };
        const onPlaying = ({ isPlaying: playing }: { isPlaying: boolean }) => {
            if (!isMountedRef.current || playerRef.current !== player) {
                return;
            }
            setVideoReady(true);
            setIsPlaying(playing);
        };

        let statusSub: { remove: () => void } | null = null;
        let playingSub: { remove: () => void } | null = null;
        try {
            statusSub = player.addListener('statusChange', onStatus);
            playingSub = player.addListener('playingChange', onPlaying);
        } catch {
            return;
        }

        return () => {
            statusSub?.remove();
            playingSub?.remove();
        };
    }, [player, playerEpoch, isActive, isPlaying]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!isPlayerUsable(player)) return;
        try {
            player.playbackRate = playbackRate;
        } catch (error) {
            console.log('Playback rate error:', error);
        }
    }, [playbackRate, player, playerEpoch]);

    useEffect(() => {
        if (!isPlayerUsable(player)) return;
        try {
            if (standalonePlayback) {
                player.muted = feedMuted;
                return;
            }
            const mayOutputAudio =
                isActive &&
                isPlaying &&
                playbackAllowed &&
                screenFocused &&
                !isManuallyPaused &&
                !(item.is_sensitive && !playSensitive) &&
                !feedMuted;
            player.muted = !mayOutputAudio;
        } catch (error) {
            console.log('Mute control error:', error);
        }
    }, [
        feedMuted,
        isActive,
        isPlaying,
        playbackAllowed,
        screenFocused,
        isManuallyPaused,
        item.is_sensitive,
        playSensitive,
        player,
        playerEpoch,
        standalonePlayback,
    ]);

    const handleFirstFrameRender = useCallback(() => {
        if (!isMountedRef.current || playerRef.current !== player) {
            return;
        }
        setFirstFrameRendered(true);
        setVideoReady(true);
    }, [player]);

    // Android textureView may not fire onFirstFrameRender while the view is opacity:0.
    useEffect(() => {
        if (!isActive || firstFrameRendered || !isPlayerUsable(player)) {
            return;
        }
        if (!isPlaying && playerStatus !== 'readyToPlay') {
            return;
        }
        const timer = setTimeout(() => {
            if (isMountedRef.current && playerRef.current === player && !firstFrameRendered) {
                setFirstFrameRendered(true);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [isActive, firstFrameRendered, isPlaying, player, playerEpoch, playerStatus]);

    useEffect(() => {
        if (!isPlayerUsable(player)) return;

        try {
            const shouldPlay =
                playbackAllowed &&
                isActive &&
                screenFocused &&
                !isManuallyPaused &&
                !(item.is_sensitive && !playSensitive);

            if (shouldPlay && playerStatus === 'readyToPlay') {
                if (!standalonePlayback && !claimFeedAudio(item.id)) {
                    return;
                }
                player.play();
                if (isMountedRef.current) {
                    setIsPlaying(true);
                }
            }
        } catch (error) {
            console.log('Play on ready error:', error);
        }
    }, [
        player,
        playerEpoch,
        playerStatus,
        isActive,
        screenFocused,
        isManuallyPaused,
        item.is_sensitive,
        playSensitive,
        playbackAllowed,
        item.id,
        standalonePlayback,
    ]);

    useEffect(() => {
        if (!isPlayerUsable(player)) return;

        try {
            const shouldPlay =
                playbackAllowed &&
                isActive &&
                screenFocused &&
                !isManuallyPaused &&
                !(item.is_sensitive && !playSensitive);

            if (isActive && !wasActiveRef.current && everActiveRef.current) {
                player.currentTime = 0;
            }
            if (isActive) {
                everActiveRef.current = true;
            }

            if (shouldPlay && isMountedRef.current) {
                if (!standalonePlayback && !claimFeedAudio(item.id)) {
                    return;
                }
                player.play();
                setIsPlaying(true);
            } else if (isMountedRef.current) {
                player.pause();
                if (!standalonePlayback) {
                    releaseFeedAudio(item.id);
                }
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
        isManuallyPaused,
        playerEpoch,
        playbackAllowed,
        item.id,
        standalonePlayback,
    ]);

    useEffect(() => {
        if (ANDROID_VIDEO_SAFE_MODE || !isFeedPlaybackActive()) {
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

    const togglePlayPause = useCallback(() => {
        const activePlayer = playerRef.current;
        if (!isPlayerUsable(activePlayer) || !isMountedRef.current || !isActive) return;

        try {
            // Use manual-pause store as source of truth — player.playing lags on Android.
            if (isManuallyPaused) {
                activePlayer.play();
                if (!standalonePlayback) {
                    claimFeedAudio(item.id);
                }
                setIsPlaying(true);
                setManuallyPaused(item.id, false);
            } else {
                activePlayer.pause();
                if (!standalonePlayback) {
                    releaseFeedAudio(item.id);
                }
                setIsPlaying(false);
                setManuallyPaused(item.id, true);
            }
        } catch (error) {
            console.log('Toggle play/pause error:', error);
        }
    }, [isActive, isManuallyPaused, item.id, setManuallyPaused, standalonePlayback]);

    const togglePlayPauseRef = useRef(togglePlayPause);
    togglePlayPauseRef.current = togglePlayPause;

    const handleTapOverlay = useCallback(() => {
        if (__DEV__) {
            console.log('[VideoPlayer] tap', { id: item.id, paused: isManuallyPaused });
        }
        togglePlayPauseRef.current();
    }, [item.id, isManuallyPaused]);

    const videoTapGesture = useMemo(
        () =>
            Gesture.Tap()
                .maxDistance(24)
                .onEnd(() => {
                    runOnJS(handleTapOverlay)();
                }),
        [handleTapOverlay],
    );

    const handleUseAudio = () => {
        if (!item.permissions?.can_use_audio) {
            Alert.alert('Not available', 'The creator has not allowed reuse of this audio.');
            return;
        }
        if (!canUseFlipCamera) {
            Alert.alert(
                'Camera required',
                'Open the Create tab to record a new video using this audio.',
            );
            return;
        }

        const source = item.audioSource ?? {
            username: item.account.username,
            profileId: item.account.id,
            postUri: item.id,
            isOriginal: true,
        };
        const referenceVideoUrl = item.media?.src_url;
        const remixSource = {
            ...source,
            isOriginal: false,
            referenceVideoUrl,
        };

        setPendingAudioReuse(remixSource);

        if (__DEV__) {
            console.log('[Remix] queued', {
                username: source.username,
                referenceVideoUrl: referenceVideoUrl?.slice(0, 80),
            });
        }

        Alert.alert(
            'Remix with this sound',
            referenceVideoUrl
                ? `Reference audio from @${source.username} will play while you record. Audio credit is attached to your post when you publish.`
                : `Audio credit from @${source.username} will be attached to your post. Record your video with this sound in mind.`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => usePendingAudioReuseStore.getState().clearPending(),
                },
                {
                    text: 'Record remix',
                    onPress: () => {
                        prepareForCameraCapture();
                        InteractionManager.runAfterInteractions(() => {
                            router.push('/create');
                        });
                    },
                },
            ],
        );
    };

    const handleViewSensitiveContent = () => {
        setPlaySensitive(true);
    };

    const likeCount = safeCount(item.likes) + (isLiked && !item.has_liked ? 1 : 0);
    const bookmarkCount =
        safeCount(item.bookmarks) + (isBookmarked && !item.has_bookmarked ? 1 : 0);
    const repostCount =
        safeCount(item.shares) +
        (isReposted && !item.has_reposted ? 1 : 0) -
        (!isReposted && item.has_reposted ? 1 : 0);

    const videoViewPlayer =
        viewPlayer && isPlayerUsable(viewPlayer) && playerRef.current === viewPlayer
            ? viewPlayer
            : null;

    if (!srcUrl) {
        return (
            <VideoSlidePlaceholder
                item={item}
                feedHeight={feedHeight}
                videoTopInset={videoTopInset}
                videoBottomReserved={videoBottomReserved}
            />
        );
    }

    if (item.is_sensitive && !playSensitive) {
        return (
            <View style={[styles.videoContainer, { height: slideHeight }]}>
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

    const videoBody = (
        <View style={[styles.videoContainer, { height: slideHeight }]} pointerEvents="box-none">
            <View style={[styles.videoWrapper, videoBandStyle]} pointerEvents="none">
                <VideoPoster thumbnail={thumbnail} />
                {videoViewPlayer ? (
                    <VideoView
                        key={`${srcUrl}-${viewEpoch}`}
                        style={[styles.video, firstFrameRendered ? styles.videoVisible : styles.videoHidden]}
                        player={videoViewPlayer}
                        allowsPictureInPicture={false}
                        nativeControls={false}
                        pointerEvents="none"
                        surfaceType="surfaceView"
                        onFirstFrameRender={handleFirstFrameRender}
                        accessible={true}
                        accessibilityLabel={item.media.alt_text || 'Video content'}
                        accessibilityHint="Tap to pause or play"
                        contentFit="cover"
                    />
                ) : null}
            </View>

            <GestureDetector gesture={videoTapGesture}>
                <View
                    style={styles.tapOverlay}
                    collapsable={false}
                    accessible={true}
                    accessibilityLabel="Video"
                    accessibilityHint="Tap to pause or play"
                    accessibilityRole="button"
                />
            </GestureDetector>

            <View
                pointerEvents="none"
                style={[styles.gradientOverlay, { bottom: feedGradientBottom }]}>
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                />
            </View>

            <FeedActionRail
                avatarUrl={item.account?.avatar}
                profileLabel={`View ${item.account.username}'s profile`}
                creatorId={item.account?.id}
                creatorUsername={item.account?.username}
                isOwnPost={item.is_owner}
                isLiked={isLiked}
                isBookmarked={isBookmarked}
                isReposted={isReposted}
                isMuted={feedMuted}
                likeCount={likeCount}
                commentCount={safeCount(item.comments)}
                bookmarkCount={bookmarkCount}
                repostCount={repostCount}
                canComment={item.permissions?.can_comment}
                canUseAudio={canUseAudio}
                bottomInset={bottomInset}
                tabBarHeight={tabBarHeight}
                overlayBottom={actionRailBottom ?? overlayBottom}
                onProfilePress={() => safeRouterPush(toProfilePath(item.account.id))}
                onLike={handleLike}
                onComment={() => onComment(item)}
                onBookmark={handleBookmark}
                onRepost={handleRepost}
                onShare={() => onShare(item)}
                onMuteToggle={toggleFeedMuted}
                onUseAudio={handleUseAudio}
                onOther={() => onOther(item)}
            />

            <View style={[styles.bottomInfo, { bottom: captionBottom }]} pointerEvents="box-none">
                <TouchableOpacity
                    onPress={() => {
                        onNavigate?.();
                        safeRouterPush(toProfilePath(item.account.id));
                    }}
                    accessible={true}
                    accessibilityLabel={`View @${item.account.username}'s profile`}
                    accessibilityRole="link">
                    <MentionText username={item.account.username} style={styles.username} />
                </TouchableOpacity>
                {item.caption && (
                    <LinkifiedCaption
                        caption={item.caption}
                        tags={item.tags || []}
                        mentions={item.mentions || []}
                        style={styles.caption}
                        numberOfLines={1}
                        onCaptionPress={() => onCaptionExpand?.(item)}
                        onHashtagPress={(tag) => {
                            onNavigate?.();
                            router.push(`/private/search?query=${tag}`);
                        }}
                        onMentionPress={(username, profileId) => {
                            onNavigate?.();
                            const target = profileId ?? username;
                            if (!target) return;
                            safeRouterPush(toProfilePath(target));
                        }}
                        onMorePress={() => onCaptionExpand?.(item)}
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

                <TouchableOpacity
                    style={styles.audioInfo}
                    onPress={() => {
                        const target = showRemixedAudio
                            ? (item.audioSource?.profileId ?? item.audioSource?.username)
                            : item.account.id;
                        if (!target) return;
                        onNavigate?.();
                        safeRouterPush(toProfilePath(target));
                    }}
                    accessible={true}
                    accessibilityLabel={
                        showRemixedAudio
                            ? `Audio from ${audioLabel}`
                            : 'Original audio from this creator'
                    }
                    accessibilityRole="button">
                    <Ionicons
                        name="musical-notes"
                        size={14}
                        color="white"
                        importantForAccessibility="no"
                    />
                    <Text style={styles.audioText}>
                        {showRemixedAudio ? `♪ ${audioLabel}` : audioLabel}
                    </Text>
                </TouchableOpacity>

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

    return videoBody;
}

const styles = StyleSheet.create({
    videoContainer: {
        width: SCREEN_WIDTH,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: POSTER_BG,
    },
    videoWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: POSTER_BG,
        overflow: 'hidden',
    },
    posterLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: POSTER_BG,
        zIndex: 2,
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
    videoHidden: {
        opacity: 0,
    },
    videoVisible: {
        opacity: 1,
    },
    tapOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: ACTION_RAIL_WIDTH,
        zIndex: 8,
        elevation: 8,
        // Near-transparent fill so Android delivers taps inside FlatList cells.
        backgroundColor: 'rgba(0,0,0,0.001)',
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
        zIndex: 10,
        elevation: 10,
    },
    username: {
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
        opacity: 0.85,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        marginTop: 4,
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
        height: '20%',
        zIndex: 3,
        elevation: 3,
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
