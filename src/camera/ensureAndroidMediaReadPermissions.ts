import * as MediaLibrary from 'expo-media-library';
import { PermissionsAndroid, Platform } from 'react-native';

export function canQueryMediaLibrary(perm: MediaLibrary.PermissionResponse): boolean {
    const accessPrivileges = (perm as { accessPrivileges?: string }).accessPrivileges;
    return Boolean(perm.granted || perm.status === 'granted' || accessPrivileges === 'limited');
}

async function hasAndroidReadMediaPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    if (Number(Platform.Version) >= 33) {
        const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        ];
        const checks = await Promise.all(permissions.map((p) => PermissionsAndroid.check(p)));
        return checks.some(Boolean);
    }

    const existing = await MediaLibrary.getPermissionsAsync();
    return canQueryMediaLibrary(existing);
}

/**
 * Check-only — never shows a permission dialog or opens a gallery/picker UI.
 * Use for optional gallery thumbnails on the Create screen.
 */
export async function hasAndroidMediaReadPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
        const perm = await MediaLibrary.getPermissionsAsync();
        return canQueryMediaLibrary(perm);
    }
    return hasAndroidReadMediaPermission();
}

/**
 * Grants read access to on-device media (MediaStore) for gallery thumbnails or saving drafts.
 *
 * On Android, uses READ_MEDIA_IMAGES + READ_MEDIA_VIDEO via PermissionsAndroid only.
 * Never calls expo-media-library requestPermissionsAsync — on Samsung/Android 14+ that
 * opens the system Photo Picker (Google Photos) instead of a plain permission sheet.
 *
 * Upload uses a separate intent-based picker and does not require this.
 * Call only from explicit user actions (e.g. Save to gallery), not on camera open.
 */
export async function ensureAndroidMediaReadPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
        const perm = await MediaLibrary.getPermissionsAsync();
        if (canQueryMediaLibrary(perm)) return true;
        const requested = await MediaLibrary.requestPermissionsAsync();
        return canQueryMediaLibrary(requested);
    }

    if (await hasAndroidReadMediaPermission()) return true;

    if (Number(Platform.Version) >= 33) {
        const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        ];
        const results = await PermissionsAndroid.requestMultiple(permissions);
        return Object.values(results).some((s) => s === PermissionsAndroid.RESULTS.GRANTED);
    }

    // Pre-API-33: avoid MediaLibrary.requestPermissionsAsync on Android (photo picker).
    return false;
}
