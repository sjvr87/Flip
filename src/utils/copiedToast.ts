import { Platform, ToastAndroid } from 'react-native';

/** Brief non-blocking "Copied" feedback — no Alert popup. */
export function showCopiedToast(message = 'Copied'): void {
    if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
    }
}
