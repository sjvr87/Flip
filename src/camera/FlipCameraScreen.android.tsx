import { MAX_RECORDING_SECONDS } from '@/camera/camerawesome/config';
import { launchUploadGalleryPicker } from '@/camera/launchUploadGalleryPicker';
import { useRecentGalleryThumb } from '@/camera/useRecentGalleryThumb';
import ReferenceAudioPlayer from '@/components/feed/ReferenceAudioPlayer';
import { ScreenFlashOverlay, useScreenFlash } from '@/components/camera/ScreenFlashOverlay';
import { remixReferenceBannerSuffix } from '@/utils/expoAudioAvailability';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { prepareForCameraCapture } from '@/utils/cameraCapturePrepare';
import { safeRouterPush } from '@/utils/safeNavigation';
import { usePendingAudioReuseStore } from '@/utils/pendingAudioReuseStore';
import { FlipCamerawesomeView } from 'flip-camerawesome';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Linking,
    Image,
    PermissionsAndroid,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

type Props = {
    onClose?: () => void;
};

type AndroidPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

const ZOOM_MIN = 1;
const ZOOM_MAX = 10;
const ZOOM_RAIL_HEIGHT = 176;
const ZOOM_RAIL_THUMB = 10;

function formatZoomLabel(value: number) {
    return value < 1.5 ? '1x' : `${value.toFixed(1)}x`;
}

function mapPermissionResult(granted: boolean, result: string | undefined): AndroidPermissionState {
    if (granted || result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    if (result === PermissionsAndroid.RESULTS.DENIED) return 'denied';
    return granted ? 'granted' : 'denied';
}

async function checkAndroidCameraPermissions(): Promise<AndroidPermissionState> {
    const cameraGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    const micGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return cameraGranted && micGranted ? 'granted' : 'denied';
}

async function requestAndroidCameraPermissions(): Promise<AndroidPermissionState> {
    const cameraGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    const micGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (cameraGranted && micGranted) return 'granted';

    const toRequest: (typeof PermissionsAndroid.PERMISSIONS.CAMERA)[] = [];
    if (!cameraGranted) toRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    if (!micGranted) toRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

    const results = await PermissionsAndroid.requestMultiple(toRequest);
    const cameraResult = mapPermissionResult(
        cameraGranted,
        results[PermissionsAndroid.PERMISSIONS.CAMERA],
    );
    const micResult = mapPermissionResult(
        micGranted,
        results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO],
    );

    if (cameraResult === 'blocked' || micResult === 'blocked') return 'blocked';
    if (cameraResult === 'granted' && micResult === 'granted') return 'granted';
    return 'denied';
}

export default function FlipCameraScreenAndroid({ onClose }: Props) {
    const router = useRouter();
    const isFocused = useIsFocused();

    const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
    const [flash, setFlash] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [permissionState, setPermissionState] = useState<AndroidPermissionState>('unknown');
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [captureMode, setCaptureMode] = useState<'video' | 'photo'>('video');
    const [photoRequestId, setPhotoRequestId] = useState(0);
    const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordingRef = useRef(false);
    const lastNativeZoomRef = useRef(1);
    const [cameraSessionKey, setCameraSessionKey] = useState(0);

    const zoom = useSharedValue(1);
    const zoomOffset = useSharedValue(1);
    const zoomRailStartY = useSharedValue(0);
    const zoomRailStartZoom = useSharedValue(1);
    const zoomIndicatorOpacity = useSharedValue(0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [zoomText, setZoomText] = useState('1x');

    const { thumbUri: galleryThumbUri, reload: reloadGalleryThumb } = useRecentGalleryThumb();
    const pendingRemix = usePendingAudioReuseStore((s) => s.pending);
    const clearPendingRemix = usePendingAudioReuseStore((s) => s.clearPending);
    const remixReferenceUrl = pendingRemix?.referenceVideoUrl;

    const { opacity: screenFlashOpacity, fireFlash, startFlash, stopFlash } = useScreenFlash();
    const shouldScreenFlash = cameraPosition === 'front' && flash;

    const syncNativeZoom = useCallback((value: number) => {
        lastNativeZoomRef.current = value;
        setZoomLevel(value);
    }, []);

    const recoverCamera = useCallback(() => {
        recordingRef.current = false;
        setIsRecording(false);
        setRecordingDuration(0);
        setIsCameraReady(false);
        setCameraSessionKey((k) => k + 1);
    }, []);

    const refreshPermissionState = useCallback(async () => {
        setPermissionState(await checkAndroidCameraPermissions());
    }, []);

    const grantPermissions = useCallback(async () => {
        setPermissionState(await requestAndroidCameraPermissions());
    }, []);

    useEffect(() => {
        grantPermissions();
    }, [grantPermissions]);

    useFocusEffect(
        useCallback(() => {
            // Release feed decoders before CameraX binds — same tick as focus so MediaCodec is free.
            prepareForCameraCapture();
            setIsCameraReady(false);
            setIsRecording(false);
            recordingRef.current = false;
            refreshPermissionState();
            reloadGalleryThumb();
            return () => {
                recordingRef.current = false;
                setIsRecording(false);
                setIsCameraReady(false);
            };
        }, [refreshPermissionState, reloadGalleryThumb]),
    );

    useEffect(() => {
        const interval = setInterval(() => {
            const value = zoom.value;
            setZoomText(formatZoomLabel(value));
            // Throttle native CameraX setZoomRatio — 20Hz React updates were freezing preview.
            const rounded = Math.round(value * 20) / 20;
            if (Math.abs(rounded - lastNativeZoomRef.current) >= 0.05) {
                lastNativeZoomRef.current = rounded;
                setZoomLevel(rounded);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [zoom]);

    const navigateToPreview = (
        mediaPath: string,
        duration: number,
        mediaType: 'video' | 'photo' = 'video',
    ) => {
        if (mediaType === 'photo') {
            safeRouterPush({
                pathname: '/private/camera/preview',
                params: { imagePath: mediaPath, mediaType: 'photo' },
            });
            return;
        }
        safeRouterPush({
            pathname: '/private/camera/preview',
            params: { videoPath: mediaPath, duration: String(duration) },
        });
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = useCallback(() => {
        if (isRecording || !isCameraReady || captureMode !== 'video') return;
        recordingRef.current = true;
        setIsRecording(true);
        if (shouldScreenFlash) startFlash();
    }, [isRecording, isCameraReady, captureMode, shouldScreenFlash, startFlash]);

    const stopRecording = useCallback(() => {
        if (!recordingRef.current) return;
        recordingRef.current = false;
        setIsRecording(false);
        stopFlash();
        zoom.value = withSpring(1);
    }, [zoom, stopFlash]);

    useEffect(() => {
        if (captureMode === 'photo' && isRecording) {
            stopRecording();
        }
    }, [captureMode, isRecording, stopRecording]);

    useEffect(() => {
        if (!isRecording) {
            setRecordingDuration(0);
            if (recordingTimer.current) {
                clearInterval(recordingTimer.current);
                recordingTimer.current = null;
            }
            return;
        }

        const startTime = Date.now();
        recordingTimer.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setRecordingDuration(elapsed);
            if (elapsed >= MAX_RECORDING_SECONDS) {
                stopRecording();
            }
        }, 250);

        return () => {
            if (recordingTimer.current) {
                clearInterval(recordingTimer.current);
                recordingTimer.current = null;
            }
        };
    }, [isRecording, stopRecording]);

    const toggleRecording = useCallback(() => {
        if (!isCameraReady || captureMode !== 'video') return;
        if (recordingRef.current) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isCameraReady, captureMode, startRecording, stopRecording]);

    const takePhoto = useCallback(() => {
        if (!isCameraReady || isRecording || captureMode !== 'photo') return;
        if (shouldScreenFlash) fireFlash(400);
        setPhotoRequestId((id) => id + 1);
    }, [isCameraReady, isRecording, captureMode, shouldScreenFlash, fireFlash]);

    const handleClose = () => {
        if (isRecording) stopRecording();
        clearPendingRemix();
        if (onClose) onClose();
        else router.canGoBack() ? router.back() : router.replace('/');
    };

    const handleRemoveRemix = () => {
        clearPendingRemix();
    };

    const handleUpload = async () => {
        try {
            // Upload uses an intent-based picker (Samsung Gallery on Samsung devices).
            // It does not require READ_MEDIA_* — the returned content URI carries a read grant.
            const result = await launchUploadGalleryPicker();
            if (!result.canceled) {
                navigateToPreview(result.uri, 0, result.type === 'image' ? 'photo' : 'video');
            } else {
                reloadGalleryThumb();
            }
        } catch {
            Alert.alert('Error', 'Failed to open gallery.');
        }
    };

    const clampZoom = (value: number) => {
        'worklet';
        return Math.max(ZOOM_MIN, Math.min(value, ZOOM_MAX));
    };

    const revealZoomIndicator = () => {
        'worklet';
        cancelAnimation(zoomIndicatorOpacity);
        zoomIndicatorOpacity.value = withTiming(1, { duration: 150 });
    };

    const hideZoomIndicatorSoon = () => {
        'worklet';
        cancelAnimation(zoomIndicatorOpacity);
        zoomIndicatorOpacity.value = withDelay(1500, withTiming(0, { duration: 200 }));
    };

    const pinchGesture = Gesture.Pinch()
        .onBegin(() => {
            'worklet';
            zoomOffset.value = zoom.value;
            revealZoomIndicator();
        })
        .onUpdate((event) => {
            'worklet';
            zoom.value = clampZoom(zoomOffset.value * event.scale);
            cancelAnimation(zoomIndicatorOpacity);
            zoomIndicatorOpacity.value = 1;
        })
        .onEnd(() => {
            'worklet';
            hideZoomIndicatorSoon();
            runOnJS(syncNativeZoom)(zoom.value);
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            'worklet';
            zoom.value = withSpring(1);
            runOnJS(syncNativeZoom)(1);
            revealZoomIndicator();
            hideZoomIndicatorSoon();
        });

    const zoomRailGesture = Gesture.Pan()
        .activeOffsetY([-6, 6])
        .onBegin((event) => {
            'worklet';
            zoomRailStartY.value = event.absoluteY;
            zoomRailStartZoom.value = zoom.value;
            revealZoomIndicator();
        })
        .onUpdate((event) => {
            'worklet';
            const deltaY = zoomRailStartY.value - event.absoluteY;
            const zoomDelta = (deltaY / ZOOM_RAIL_HEIGHT) * (ZOOM_MAX - ZOOM_MIN);
            zoom.value = clampZoom(zoomRailStartZoom.value + zoomDelta);
            cancelAnimation(zoomIndicatorOpacity);
            zoomIndicatorOpacity.value = 1;
        })
        .onEnd(() => {
            'worklet';
            hideZoomIndicatorSoon();
            runOnJS(syncNativeZoom)(zoom.value);
        });

    const tapVideoGesture = Gesture.Tap()
        .numberOfTaps(1)
        .onEnd(() => {
            'worklet';
            runOnJS(toggleRecording)();
        });

    const tapPhotoGesture = Gesture.Tap()
        .numberOfTaps(1)
        .onEnd(() => {
            'worklet';
            runOnJS(takePhoto)();
        });

    const recordButtonGesture = captureMode === 'photo' ? tapPhotoGesture : tapVideoGesture;
    const cameraGestures = Gesture.Race(doubleTapGesture, pinchGesture);

    const zoomThumbStyle = useAnimatedStyle(() => {
        const progress = (zoom.value - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
        return {
            top: (1 - progress) * (ZOOM_RAIL_HEIGHT - ZOOM_RAIL_THUMB),
        };
    });

    const zoomRailStyle = useAnimatedStyle(() => ({
        opacity: 0.28 + zoomIndicatorOpacity.value * 0.52,
    }));

    const zoomIndicatorStyle = useAnimatedStyle(() => ({
        opacity: zoomIndicatorOpacity.value,
        transform: [{ scale: withSpring(zoomIndicatorOpacity.value > 0 ? 1 : 0.85) }],
    }));

    if (permissionState === 'denied' || permissionState === 'blocked') {
        const blocked = permissionState === 'blocked';
        return (
            <View style={styles.container}>
                <View style={styles.permissionContent}>
                    <Ionicons name="camera-outline" size={80} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.permissionTitle}>Camera & Microphone Access</Text>
                    <Text style={styles.permissionDescription}>
                        {blocked
                            ? 'Flip needs camera and microphone access to record. Android blocked the permission prompt — open Settings and enable Camera and Microphone for Flip.'
                            : 'Flip needs camera and microphone access to record video. Gallery access alone is not enough — tap below to grant Camera and Microphone.'}
                    </Text>
                    {!blocked ? (
                        <TouchableOpacity
                            style={styles.permissionButton}
                            onPress={grantPermissions}>
                            <Text style={styles.permissionButtonText}>Grant permissions</Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity onPress={() => Linking.openSettings()}>
                        <Text style={styles.settingsButtonText}>Open Settings</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (permissionState === 'unknown') {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.loadingText}>Initializing CameraX…</Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <ScreenFlashOverlay opacity={screenFlashOpacity} />
            {isCameraReady && remixReferenceUrl ? (
                <ReferenceAudioPlayer url={remixReferenceUrl} active={isFocused} />
            ) : null}
            <GestureDetector gesture={cameraGestures}>
                <View style={StyleSheet.absoluteFill}>
                    <FlipCamerawesomeView
                        key={cameraSessionKey}
                        style={StyleSheet.absoluteFill}
                        facing={cameraPosition}
                        zoom={zoomLevel}
                        torchEnabled={flash && cameraPosition === 'back'}
                        isActive={isFocused}
                        recording={isRecording}
                        captureMode={captureMode}
                        photoRequestId={photoRequestId}
                        onCameraReady={() => {
                            setIsCameraReady(true);
                            if (__DEV__ && remixReferenceUrl) {
                                console.log(
                                    '[FlipCamera] ready; remix url:',
                                    remixReferenceUrl.slice(0, 80),
                                );
                            }
                        }}
                        onRecordingFinished={(e) => {
                            recordingRef.current = false;
                            setIsRecording(false);
                            const path = e.nativeEvent.uri || e.nativeEvent.path;
                            navigateToPreview(path, recordingDuration, 'video');
                        }}
                        onPhotoCaptured={(e) => {
                            const path = e.nativeEvent.uri || e.nativeEvent.path;
                            navigateToPreview(path, 0, 'photo');
                        }}
                        onPhotoCaptureError={(e) => {
                            Alert.alert('Photo error', e.nativeEvent.message);
                        }}
                        onRecordingError={(e) => {
                            recoverCamera();
                            Alert.alert('Recording error', e.nativeEvent.message);
                        }}
                        onCameraError={(e) => {
                            recoverCamera();
                            Alert.alert('Camera error', e.nativeEvent.message);
                        }}
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
                        style={styles.gradientOverlay}
                        pointerEvents="none"
                    />
                </View>
            </GestureDetector>

            <View style={styles.topBar}>
                <PressableHaptics onPress={handleClose} style={styles.topButton}>
                    <Ionicons name="close" size={28} color="#fff" />
                </PressableHaptics>
                {pendingRemix ? (
                    <View style={styles.remixBanner}>
                        <Ionicons name="musical-notes" size={14} color="#22D3EE" />
                        <Text style={styles.remixBannerText} numberOfLines={1}>
                            Remix @{pendingRemix.username}
                            {remixReferenceUrl
                                ? remixReferenceBannerSuffix(remixReferenceUrl)
                                : ' · credit attached'}
                        </Text>
                        <PressableHaptics
                            onPress={handleRemoveRemix}
                            style={styles.remixRemoveButton}
                            accessibilityLabel="Remove remix audio"
                            accessibilityHint="Stops reference audio and clears remix credit while keeping the camera open">
                            <Ionicons name="close" size={16} color="rgba(255,255,255,0.85)" />
                        </PressableHaptics>
                    </View>
                ) : (
                    <View style={styles.topButton} />
                )}
            </View>

            <GestureDetector gesture={zoomRailGesture}>
                <Reanimated.View style={styles.zoomRailHitArea}>
                    <Reanimated.View style={[styles.zoomRailTrack, zoomRailStyle]}>
                        <Reanimated.View style={[styles.zoomRailThumb, zoomThumbStyle]} />
                    </Reanimated.View>
                </Reanimated.View>
            </GestureDetector>

            <Reanimated.View
                style={[styles.zoomIndicator, zoomIndicatorStyle]}
                pointerEvents="none">
                <Text style={styles.zoomText}>{zoomText}</Text>
            </Reanimated.View>

            <View style={styles.rightControls}>
                <PressableHaptics
                    onPress={() => {
                        if (isRecording) stopRecording();
                        setCameraPosition((p) => (p === 'back' ? 'front' : 'back'));
                    }}
                    style={styles.controlButton}>
                    <Ionicons name="camera-reverse" size={28} color="#fff" />
                </PressableHaptics>
                <TouchableOpacity onPress={() => setFlash((f) => !f)} style={styles.controlButton}>
                    <Ionicons name={flash ? 'flash' : 'flash-off'} size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.modeBar}>
                <TouchableOpacity
                    onPress={() => {
                        if (isRecording) stopRecording();
                        setCaptureMode('video');
                    }}
                    style={[styles.modeChip, captureMode === 'video' && styles.modeChipActive]}>
                    <Text
                        style={[
                            styles.modeChipText,
                            captureMode === 'video' && styles.modeChipTextActive,
                        ]}>
                        Video
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        if (isRecording) stopRecording();
                        setCaptureMode('photo');
                    }}
                    style={[styles.modeChip, captureMode === 'photo' && styles.modeChipActive]}>
                    <Text
                        style={[
                            styles.modeChipText,
                            captureMode === 'photo' && styles.modeChipTextActive,
                        ]}>
                        Photo
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.bottomContainer}>
                {isRecording && (
                    <View style={styles.recordingIndicator}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingTime}>
                            {formatDuration(recordingDuration)}
                        </Text>
                    </View>
                )}

                <View style={styles.bottomControls}>
                    <TouchableOpacity onPress={handleUpload} style={styles.uploadButton}>
                        <View style={styles.uploadIconWrapper}>
                            {galleryThumbUri ? (
                                <Image
                                    source={{ uri: galleryThumbUri }}
                                    style={styles.uploadIconInner}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.uploadIconPlaceholder}>
                                    <Ionicons
                                        name="images-outline"
                                        size={20}
                                        color="rgba(255,255,255,0.7)"
                                    />
                                </View>
                            )}
                        </View>
                        <Text style={styles.bottomButtonText}>Upload</Text>
                    </TouchableOpacity>

                    <GestureDetector gesture={recordButtonGesture}>
                        <Reanimated.View style={styles.recordButtonContainer}>
                            <View
                                style={[
                                    styles.recordButton,
                                    isRecording && styles.recordButtonActive,
                                ]}>
                                <View
                                    style={[
                                        styles.recordButtonInner,
                                        isRecording && styles.recordButtonInnerActive,
                                    ]}
                                />
                            </View>
                            <Text style={styles.recordHint}>
                                {captureMode === 'photo'
                                    ? 'Tap to capture'
                                    : isRecording
                                      ? 'Tap to stop'
                                      : 'Tap to record'}
                            </Text>
                        </Reanimated.View>
                    </GestureDetector>

                    <View style={styles.effectsButton} />
                </View>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#fff', fontSize: 16 },
    permissionContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 16,
    },
    permissionTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
    permissionDescription: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    permissionButton: {
        backgroundColor: '#0085ff',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 12,
    },
    permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    settingsButtonText: { color: 'rgba(255,255,255,0.7)', marginTop: 8 },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 56,
        paddingHorizontal: 16,
        zIndex: 10,
    },
    topButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    remixBanner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginHorizontal: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    remixBannerText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 1,
    },
    remixRemoveButton: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 2,
    },
    rightControls: { position: 'absolute', right: 28, top: '35%', zIndex: 10, gap: 20 },
    zoomRailHitArea: {
        position: 'absolute',
        right: 0,
        top: '40%',
        width: 44,
        height: ZOOM_RAIL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9,
    },
    zoomRailTrack: {
        width: 3,
        height: ZOOM_RAIL_HEIGHT,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.35)',
        justifyContent: 'flex-start',
    },
    zoomRailThumb: {
        position: 'absolute',
        left: -((ZOOM_RAIL_THUMB - 3) / 2),
        width: ZOOM_RAIL_THUMB,
        height: ZOOM_RAIL_THUMB,
        borderRadius: ZOOM_RAIL_THUMB / 2,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
    },
    zoomIndicator: {
        position: 'absolute',
        top: '44%',
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 10,
        zIndex: 11,
    },
    zoomText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    controlButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 40 },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 8,
    },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff0000' },
    recordingTime: { color: '#fff', fontSize: 15, fontWeight: '600' },
    bottomControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    uploadButton: { alignItems: 'center', width: 70 },
    uploadIconWrapper: {
        width: 46,
        height: 46,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    uploadIconInner: { width: 46, height: 46, borderRadius: 8 },
    uploadIconPlaceholder: {
        width: 46,
        height: 46,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomButtonText: { color: '#fff', fontSize: 12, fontWeight: '800', marginTop: 4 },
    effectsButton: { width: 70 },
    recordButtonContainer: { alignItems: 'center', gap: 8 },
    recordButton: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 4,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordButtonActive: { borderColor: '#0085ff' },
    recordButtonInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },
    recordButtonInnerActive: {
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: '#0085ff',
    },
    recordHint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center' },
    modeBar: {
        position: 'absolute',
        bottom: 150,
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 8,
        zIndex: 10,
    },
    modeChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    modeChipActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
    modeChipText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
    modeChipTextActive: { color: '#000' },
    gradientOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%' },
});
