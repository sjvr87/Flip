import { Platform } from 'react-native';

/**
 * Samsung / Android 17 beta: expo-video prefetch + multi-player mount SIGSEGV Hermes.
 * Keep at most 2 decoders (active + 1 neighbor), debounce teardown, shrink FlatList window.
 */
export const ANDROID_VIDEO_SAFE_MODE = Platform.OS === 'android';

export const shouldPrefetchVideo = !ANDROID_VIDEO_SAFE_MODE;

/** Android: active + one neighbor — 0 preload broke playback; >1 risks MediaCodec OOM. */
export const feedPlayerPreloadDistance = 1;

/** Wider window keeps thumbnail placeholders mounted during fast scroll. */
export const feedFlatListWindowSize = ANDROID_VIDEO_SAFE_MODE ? 5 : 7;

export const feedInitialNumToRender = ANDROID_VIDEO_SAFE_MODE ? 2 : 2;

export const feedMaxToRenderPerBatch = ANDROID_VIDEO_SAFE_MODE ? 3 : 3;

/** Cells within this distance always mount (thumbnail placeholder at minimum). */
export const feedCellMountRadius = ANDROID_VIDEO_SAFE_MODE ? 3 : 4;

/** Debounce inactive player teardown so the next slide can reach playing state. */
export const feedPlayerReleaseDelayMs = ANDROID_VIDEO_SAFE_MODE ? 450 : 500;

/** HLS player prefetch stays off on Android — thumbnail prefetch is handled separately. */
export const feedPrefetchAhead = ANDROID_VIDEO_SAFE_MODE ? 0 : 1;

/** Skip biometric auto-prompt on cold start — native prompt races feed/video init. */
export const skipBiometricAutoPromptOnLaunch = ANDROID_VIDEO_SAFE_MODE;
