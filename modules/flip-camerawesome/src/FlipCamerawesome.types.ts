export type FlipCamerawesomeViewProps = {
  facing?: 'front' | 'back'
  zoom?: number
  torchEnabled?: boolean
  isActive?: boolean
  recording?: boolean
  photoRequestId?: number
  style?: object
  onCameraReady?: () => void
  onRecordingFinished?: (event: { nativeEvent: { path: string; uri: string } }) => void
  onRecordingError?: (event: { nativeEvent: { message: string } }) => void
  onPhotoCaptured?: (event: { nativeEvent: { path: string; uri: string } }) => void
  onPhotoCaptureError?: (event: { nativeEvent: { message: string } }) => void
  onCameraError?: (event: { nativeEvent: { message: string } }) => void
}

export type CaptureProfile = {
  platform: string
  engine: string
  resolution: string
  targetFps: number
  videoStabilization: boolean
  quality: string
}

export type GalleryPickerResult =
  | { canceled: true }
  | { canceled: false; uri: string; type: 'image' | 'video' }

export const FLIP_CAMERA_CAPTURE = {
  resolution: '1080p' as const,
  width: 1920,
  height: 1080,
  targetFps: 60,
  videoStabilization: true,
  quality: 'FHD' as const,
  engine: 'CameraX' as const,
}
