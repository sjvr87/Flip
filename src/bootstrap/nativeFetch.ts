import { Platform } from 'react-native';
import { fetch as reactNativeFetch } from 'react-native/Libraries/Network/fetch';

/**
 * React Native networking fetch, captured before Expo 56 winter runtime may
 * replace globalThis.fetch with expo/fetch (breaks @atproto DID resolution).
 * @see https://github.com/expo/expo/issues/45909
 */
export const nativeFetch: typeof fetch =
    Platform.OS === 'web' ? fetch.bind(globalThis) : (reactNativeFetch as typeof fetch);

let installed = false;

/** Keep RN fetch global for code paths that read globalThis.fetch (OAuth identity resolver). */
export function installNativeFetchGlobal(): void {
    if (installed || Platform.OS === 'web') return;
    installed = true;
    globalThis.fetch = nativeFetch;
    if (__DEV__) {
        console.log('[fetch] Using React Native fetch (expo/fetch bypassed for ATProto OAuth)');
    }
}

installNativeFetchGlobal();
