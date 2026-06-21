import { isRunningInExpoGo } from 'expo'
import { Platform } from 'react-native'

/**
 * True when running inside the Expo Go client (no custom native modules).
 * Uses the ExpoGo native module probe — do not use executionEnvironment ===
 * 'storeClient', which also matches expo-dev-client / EAS development builds.
 */
export const isExpoGo = isRunningInExpoGo()

export const isWeb = Platform.OS === 'web'

function probeNativeModule(moduleName: string): boolean {
    if (isWeb) return false
    try {
        const { requireNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core')
        requireNativeModule(moduleName)
        return true
    } catch {
        return false
    }
}

/** True when flip-camerawesome is linked in the running binary (dev or release). */
export const hasFlipCameraModule = probeNativeModule('FlipCamerawesome')

/**
 * True when the app has a custom native binary (dev client or store build).
 * Prefer hasFlipCameraModule for camera gating — it reflects the actual module.
 */
export const hasCustomNativeBinary = !isWeb && !isExpoGo

/** Camera tab / duet recorder available on this device. */
export const canUseFlipCamera = hasFlipCameraModule

/** Prefer safe (no custom native) code paths — Expo Go only. */
export const useSafeNativeShims = isExpoGo
