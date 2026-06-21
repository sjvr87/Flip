/** CameraX capture profile for flagship Android (Samsung Galaxy Ultra class). */
export const FLIP_ANDROID_CAPTURE = {
  engine: 'CameraX' as const,
  package: 'flip-camerawesome',
  resolution: { width: 1920, height: 1080 },
  targetFps: 60,
  quality: 'FHD' as const,
  videoStabilization: true,
  /** 12 Mbps — suitable for 1080p60 on flagship sensors */
  videoBitrate: 12_000_000,
}

export const MAX_RECORDING_SECONDS = 180
