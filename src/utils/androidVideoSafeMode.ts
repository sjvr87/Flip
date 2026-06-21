import { Platform } from 'react-native';

/**
 * Samsung / Android 17 beta: expo-video prefetch + multi-player mount SIGSEGV Hermes.
 * Disable prefetch, mount only the active slide, shrink FlatList window until stable.
 */
export const ANDROID_VIDEO_SAFE_MODE = Platform.OS === 'android';

export const shouldPrefetchVideo = !ANDROID_VIDEO_SAFE_MODE;

/** Mount adjacent slide players so swipe lands on a warmed player, not a cold mount. */
export const feedPlayerPreloadDistance = ANDROID_VIDEO_SAFE_MODE ? 1 : 2;

export const feedFlatListWindowSize = ANDROID_VIDEO_SAFE_MODE ? 5 : 7;

export const feedInitialNumToRender = ANDROID_VIDEO_SAFE_MODE ? 2 : 3;

export const feedMaxToRenderPerBatch = ANDROID_VIDEO_SAFE_MODE ? 2 : 3;

/** HLS player prefetch stays off on Android — thumbnail prefetch is handled separately. */
export const feedPrefetchAhead = ANDROID_VIDEO_SAFE_MODE ? 0 : 2;

/** Skip biometric auto-prompt on cold start — native prompt races feed/video init. */
export const skipBiometricAutoPromptOnLaunch = ANDROID_VIDEO_SAFE_MODE;

/** Skip silent credential relogin on cold start — show sign-in form instead. */
export const skipSilentAutoReloginOnLaunch = ANDROID_VIDEO_SAFE_MODE;
