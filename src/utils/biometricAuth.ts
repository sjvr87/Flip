import { isWeb, useSafeNativeShims } from '@/utils/runtime'
import { Platform } from 'react-native'

export async function canUseBiometrics(): Promise<boolean> {
  if (isWeb || useSafeNativeShims) return false

  try {
    const LocalAuthentication = await import('expo-local-authentication')
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const isEnrolled = await LocalAuthentication.isEnrolledAsync()
    return hasHardware && isEnrolled
  } catch {
    return false
  }
}

export async function getBiometricLabel(): Promise<string> {
  if (Platform.OS === 'ios') {
    try {
      const LocalAuthentication = await import('expo-local-authentication')
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
      const { AuthenticationType } = LocalAuthentication
      if (types.includes(AuthenticationType.FACIAL_RECOGNITION)) {
        return 'Face ID'
      }
      if (types.includes(AuthenticationType.FINGERPRINT)) {
        return 'Touch ID'
      }
    } catch {
      // fall through
    }
    return 'Face ID'
  }

  return 'Fingerprint'
}

export async function authenticateWithBiometric(
  promptMessage = 'Unlock Flip',
): Promise<boolean> {
  if (!(await canUseBiometrics())) return false

  try {
    const LocalAuthentication = await import('expo-local-authentication')
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use password',
      disableDeviceFallback: true,
    })
    return result.success
  } catch {
    return false
  }
}
