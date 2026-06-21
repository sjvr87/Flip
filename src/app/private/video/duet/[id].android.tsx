import FlipCameraScreenAndroid from '@/camera/FlipCameraScreen.android'
import { useLocalSearchParams, useRouter } from 'expo-router'

/** Android duet entry — CameraX 1080p60 recorder (PiP duet layout planned). */
export default function DuetCameraScreenAndroid() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  return (
    <FlipCameraScreenAndroid onClose={() => router.replace(`/private/video/${id}`)} />
  )
}
