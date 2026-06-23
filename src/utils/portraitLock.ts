import { AppState, Platform } from 'react-native';

type ScreenOrientationModule = typeof import('expo-screen-orientation');

function getScreenOrientationModule(): ScreenOrientationModule | null {
    if (Platform.OS === 'web') {
        return null;
    }
    try {
        return require('expo-screen-orientation') as ScreenOrientationModule;
    } catch {
        return null;
    }
}

/** Keep the app in upright portrait — re-applied when returning from camera/video. */
export function lockPortraitOrientation(): void {
    try {
        const ScreenOrientation = getScreenOrientationModule();
        if (!ScreenOrientation) {
            return;
        }

        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
            () => {},
        );
    } catch {
        // expo-screen-orientation not linked in this dev client yet
    }
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
