import { Platform } from 'react-native';

/**
 * Samsung / Android 17 beta: expo-video prefetch + multi-player mount SIGSEGV Hermes.
 * Disable prefetch, mount only the active slide, shrink FlatList window until stable.
 */
export const ANDROID_VIDEO_SAFE_MODE = Platform.OS === 'android';

export const shouldPrefetchVideo = !ANDROID_VIDEO_SAFE_MODE;

/** Mount at most one neighbor player so swipe lands warm without multi-decode churn. */
export const feedPlayerPreloadDistance = 1;

export const feedFlatListWindowSize = ANDROID_VIDEO_SAFE_MODE ? 5 : 6;

export const feedInitialNumToRender = ANDROID_VIDEO_SAFE_MODE ? 2 : 2;

export const feedMaxToRenderPerBatch = ANDROID_VIDEO_SAFE_MODE ? 2 : 2;

/** HLS player prefetch stays off on Android — thumbnail prefetch is handled separately. */
export const feedPrefetchAhead = ANDROID_VIDEO_SAFE_MODE ? 0 : 1;

/** Skip biometric auto-prompt on cold start — native prompt races feed/video init. */
export const skipBiometricAutoPromptOnLaunch = ANDROID_VIDEO_SAFE_MODE;

/** Skip silent credential relogin on cold start — show sign-in form instead. */
export const skipSilentAutoReloginOnLaunch = ANDROID_VIDEO_SAFE_MODE;
