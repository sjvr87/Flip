import { NativeModules } from 'react-native';

type ExpoAudioExports = typeof import('expo-audio');

let cachedModule: ExpoAudioExports | null | undefined;

/** True when the dev client includes the native ExpoAudio module. */
export function isExpoAudioAvailable(): boolean {
    return getExpoAudioModule() != null;
}

/** Banner suffix for remix flows when a reference clip URL is attached. */
export function remixReferenceBannerSuffix(referenceVideoUrl: string | undefined): string {
    if (!referenceVideoUrl) {
        return '';
    }
    if (!isExpoAudioAvailable()) {
        return ' · rebuild app to hear reference';
    }
    return ' · reference playing';
}

/** Lazy-load expo-audio only when the native module is present (avoids startup crash). */
export function getExpoAudioModule(): ExpoAudioExports | null {
    if (cachedModule !== undefined) {
        return cachedModule;
    }

    try {
        if (!NativeModules.ExpoAudio) {
            cachedModule = null;
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cachedModule = require('expo-audio') as ExpoAudioExports;
        return cachedModule;
    } catch {
        cachedModule = null;
        return null;
    }
}
