import MobileOnlyScreen from '@/components/MobileOnlyScreen'
import { canUseFlipCamera } from '@/utils/runtime'

/** Android camera tab — CameraX via flip-camerawesome (dev build only). */
export default function CameraScreen() {
  if (!canUseFlipCamera) {
    return <MobileOnlyScreen title="Create" />
  }
  const FlipCameraScreenAndroid =
    require('@/camera/FlipCameraScreen.android').default

  return <FlipCameraScreenAndroid />
}
