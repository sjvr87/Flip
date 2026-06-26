import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

/** Multiverse API base URL (no trailing slash). */
export function getMultiverseApiBase(): string {
    const fromEnv = process.env.EXPO_PUBLIC_FLIP_API_URL;
    if (fromEnv) return fromEnv.replace(/\/$/, '');

    const fromExtra = extra.flipMultiverseApiUrl as string | undefined;
    if (fromExtra) return fromExtra.replace(/\/$/, '');

    // Android emulator → host loopback; device dev uses adb reverse or LAN IP
    return 'http://127.0.0.1:8788';
}

export function isMultiverseEnabled(): boolean {
    const flag = extra.flipMultiverseEnabled;
    if (flag === false) return false;
    return true;
}
