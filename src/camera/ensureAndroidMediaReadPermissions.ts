import * as MediaLibrary from 'expo-media-library'
import { PermissionsAndroid, Platform } from 'react-native'

export function canQueryMediaLibrary(perm: MediaLibrary.PermissionResponse): boolean {
  const accessPrivileges = (perm as { accessPrivileges?: string }).accessPrivileges
  return Boolean(perm.granted || perm.status === 'granted' || accessPrivileges === 'limited')
}

/**
 * Grants read access to on-device media (MediaStore) for gallery thumbnails.
 *
 * On Android 13+, uses READ_MEDIA_IMAGES + READ_MEDIA_VIDEO via PermissionsAndroid
 * so the standard system permission sheet appears instead of expo-media-library's
 * Photo Picker flow (which on many Samsung devices only offers Google Photos).
 *
 * Upload uses a separate intent-based picker and does not require this.
 */
export async function ensureAndroidMediaReadPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    const perm = await MediaLibrary.getPermissionsAsync()
    if (canQueryMediaLibrary(perm)) return true
    const requested = await MediaLibrary.requestPermissionsAsync()
    return canQueryMediaLibrary(requested)
  }

  if (Number(Platform.Version) >= 33) {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
    ]
    const alreadyGranted = await Promise.all(permissions.map((p) => PermissionsAndroid.check(p)))
    if (alreadyGranted.some(Boolean)) return true

    const results = await PermissionsAndroid.requestMultiple(permissions)
    if (Object.values(results).some((s) => s === PermissionsAndroid.RESULTS.GRANTED)) {
      return true
    }
  }

  const existing = await MediaLibrary.getPermissionsAsync()
  if (canQueryMediaLibrary(existing)) return true

  // Avoid requestPermissionsAsync on Android 14+ — it may open the Photo Picker
  // (Google Photos on Samsung) instead of a plain permission dialog.
  if (Number(Platform.Version) >= 34) return false

  const requested = await MediaLibrary.requestPermissionsAsync()
  return canQueryMediaLibrary(requested)
}
