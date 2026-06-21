/** CameraX capture profile for flagship Android (Samsung Galaxy Ultra class). */
export const FLIP_ANDROID_CAPTURE = {
  engine: 'CameraX' as const,
  package: 'flip-camerawesome',
  resolution: { width: 3840, height: 2160 },
  targetFps: 60,
  quality: 'UHD' as const,
  fallbackQuality: 'FHD' as const,
  videoStabilization: true,
  /** 45 Mbps target for UHD60; CameraX falls back to FHD when UHD is unsupported */
  videoBitrate: 45_000_000,
}

export const MAX_RECORDING_SECONDS = 180
