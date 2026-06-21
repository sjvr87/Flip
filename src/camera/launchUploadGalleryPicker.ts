import { MAX_RECORDING_SECONDS } from '@/camera/camerawesome/config'
import { launchGalleryPicker } from 'flip-camerawesome'
import * as Device from 'expo-device'
import * as ImagePicker from 'expo-image-picker'
import { Alert, Platform } from 'react-native'

export type UploadGalleryPickResult =
  | { canceled: true }
  | { canceled: false; uri: string; type: 'image' | 'video' }

function isSamsungAndroid(): boolean {
  if (Platform.OS !== 'android') return false
  const manufacturer = Device.manufacturer?.toLowerCase() ?? ''
  const brand = Device.brand?.toLowerCase() ?? ''
  return manufacturer === 'samsung' || brand === 'samsung'
}

/** Opens Samsung Gallery on Samsung devices; falls back to legacy GET_CONTENT picker. */
export async function launchUploadGalleryPicker(): Promise<UploadGalleryPickResult> {
  try {
    const nativeResult = await launchGalleryPicker()
    if (nativeResult.canceled) return { canceled: true }
    return {
      canceled: false,
      uri: nativeResult.uri,
      type: nativeResult.type,
    }
  } catch (error) {
    console.warn('[launchUploadGalleryPicker] Native gallery picker failed:', error)

    if (isSamsungAndroid()) {
      Alert.alert(
        'Gallery unavailable',
        'Samsung Gallery could not be opened. Rebuild the Flip dev app (npm run android:build) so the native gallery module is included.',
      )
      return { canceled: true }
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos', 'images'],
    allowsEditing: true,
    aspect: [9, 16],
    quality: 1,
    selectionLimit: 1,
    videoMaxDuration: MAX_RECORDING_SECONDS,
    legacy: true,
  })

  if (!result.assets?.[0]) return { canceled: true }

  const asset = result.assets[0]
  return {
    canceled: false,
    uri: asset.uri,
    type: asset.type === 'image' ? 'image' : 'video',
  }
}
