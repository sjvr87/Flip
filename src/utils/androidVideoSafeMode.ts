import { Platform } from 'react-native';

/**
 * Samsung / Android 17 beta: expo-video prefetch + multi-player mount SIGSEGV Hermes.
 * Keep at most 2 decoders (active + 1 neighbor), debounce teardown, shrink FlatList window.
 */
export const ANDROID_VIDEO_SAFE_MODE = Platform.OS === 'android';

export const shouldPrefetchVideo = !ANDROID_VIDEO_SAFE_MODE;

/** Android: active + one neighbor — 0 preload broke playback; >1 risks MediaCodec OOM. */
export const feedPlayerPreloadDistance = 1;

export const feedFlatListWindowSize = ANDROID_VIDEO_SAFE_MODE ? 3 : 6;

export const feedInitialNumToRender = ANDROID_VIDEO_SAFE_MODE ? 1 : 2;

export const feedMaxToRenderPerBatch = ANDROID_VIDEO_SAFE_MODE ? 2 : 2;

/** Debounce inactive player teardown so the next slide can reach playing state. */
export const feedPlayerReleaseDelayMs = ANDROID_VIDEO_SAFE_MODE ? 250 : 400;

/** HLS player prefetch stays off on Android — thumbnail prefetch is handled separately. */
export const feedPrefetchAhead = ANDROID_VIDEO_SAFE_MODE ? 0 : 1;

/** Skip biometric auto-prompt on cold start — native prompt races feed/video init. */
export const skipBiometricAutoPromptOnLaunch = ANDROID_VIDEO_SAFE_MODE;
