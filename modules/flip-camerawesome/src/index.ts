import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core'
import type { FlipCamerawesomeViewProps, CaptureProfile } from './FlipCamerawesome.types'

export const FlipCamerawesomeView =
  requireNativeViewManager<FlipCamerawesomeViewProps>('FlipCamerawesome')

const FlipCamerawesomeNative = requireNativeModule<{
  getCaptureProfile: () => CaptureProfile
}>('FlipCamerawesome')

export async function getCaptureProfile(): Promise<CaptureProfile> {
  return FlipCamerawesomeNative.getCaptureProfile()
}

export * from './FlipCamerawesome.types'
