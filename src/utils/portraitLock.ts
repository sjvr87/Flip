import * as ScreenOrientation from 'expo-screen-orientation';
import { AppState, Platform } from 'react-native';

/** Keep the app in upright portrait — re-applied when returning from camera/video. */
export function lockPortraitOrientation(): void {
    if (Platform.OS === 'web') {
        return;
    }

    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
}

export function subscribePortraitOrientationLock(): () => void {
    if (Platform.OS === 'web') {
        return () => {};
    }

    lockPortraitOrientation();

    const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            lockPortraitOrientation();
        }
    });

    return () => subscription.remove();
}
