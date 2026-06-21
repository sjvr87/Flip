import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core'
import type { FlipCamerawesomeViewProps, CaptureProfile, GalleryPickerResult } from './FlipCamerawesome.types'

export const FlipCamerawesomeView =
  requireNativeViewManager<FlipCamerawesomeViewProps>('FlipCamerawesome')

const FlipCamerawesomeNative = requireNativeModule<{
  getCaptureProfile: () => CaptureProfile
  launchGalleryPickerAsync: () => GalleryPickerResult
}>('FlipCamerawesome')

export async function getCaptureProfile(): Promise<CaptureProfile> {
  return FlipCamerawesomeNative.getCaptureProfile()
}

export async function launchGalleryPicker(): Promise<GalleryPickerResult> {
  return FlipCamerawesomeNative.launchGalleryPickerAsync()
}

export * from './FlipCamerawesome.types'
