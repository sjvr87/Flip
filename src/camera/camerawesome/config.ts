/** CameraX capture profile — keep in sync with FlipCaptureProfile.kt */
export const FLIP_ANDROID_CAPTURE = {
    engine: 'CameraX' as const,
    package: 'flip-camerawesome',
    flagship: {
        resolution: { width: 1920, height: 1080 },
        quality: 'FHD' as const,
        badge: '1080p60 · OIS',
        videoBitrate: 18_000_000,
    },
    standard: {
        resolution: { width: 1920, height: 1080 },
        quality: 'FHD' as const,
        badge: '1080p60 · OIS',
        videoBitrate: 12_000_000,
    },
    targetFps: 60,
    videoStabilization: true,
} as const;

export const MAX_RECORDING_SECONDS = 180;
