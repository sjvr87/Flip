import { Platform } from 'react-native';

/**
 * Samsung / Android 17 beta: expo-video prefetch + multi-player mount SIGSEGV Hermes.
 * Disable prefetch, mount only the active slide, shrink FlatList window until stable.
 */
export const ANDROID_VIDEO_SAFE_MODE = Platform.OS === 'android';

export const shouldPrefetchVideo = !ANDROID_VIDEO_SAFE_MODE;

/** Android: active slide only — extra decoders OOM MediaCodec on fast swipe. */
export const feedPlayerPreloadDistance = ANDROID_VIDEO_SAFE_MODE ? 0 : 1;

export const feedFlatListWindowSize = ANDROID_VIDEO_SAFE_MODE ? 3 : 6;

export const feedInitialNumToRender = ANDROID_VIDEO_SAFE_MODE ? 1 : 2;

export const feedMaxToRenderPerBatch = ANDROID_VIDEO_SAFE_MODE ? 1 : 2;

/** Release inactive slide player immediately on Android (no warm handoff). */
export const feedPlayerReleaseDelayMs = ANDROID_VIDEO_SAFE_MODE ? 0 : 400;

/** HLS player prefetch stays off on Android — thumbnail prefetch is handled separately. */
export const feedPrefetchAhead = ANDROID_VIDEO_SAFE_MODE ? 0 : 1;

/** Skip biometric auto-prompt on cold start — native prompt races feed/video init. */
export const skipBiometricAutoPromptOnLaunch = ANDROID_VIDEO_SAFE_MODE;

/** Skip silent credential relogin on cold start — show sign-in form instead. */
export const skipSilentAutoReloginOnLaunch = ANDROID_VIDEO_SAFE_MODE;
