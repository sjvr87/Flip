import { getExpoAudioModule, isExpoAudioAvailable } from '@/utils/expoAudioAvailability';
import { useEffect } from 'react';

type ReferenceAudioPlayerProps = {
    url: string;
    active?: boolean;
    /** Re-apply audio session when camera recording starts (Android mic + playback). */
    recordingActive?: boolean;
};

const REFERENCE_AUDIO_MODE = {
    playsInSilentMode: true,
    interruptionMode: 'duckOthers' as const,
};

/** Audio-only playback for remix/create flows (no VideoView — avoids camera decoder conflicts on Android). */
export default function ReferenceAudioPlayer({
    url,
    active = true,
    recordingActive = false,
}: ReferenceAudioPlayerProps) {
    if (!isExpoAudioAvailable() || !url) {
        return null;
    }

    return (
        <ReferenceAudioPlayerActive
            url={url}
            active={active}
            recordingActive={recordingActive}
        />
    );
}

function ReferenceAudioPlayerActive({
    url,
    active,
    recordingActive,
}: {
    url: string;
    active: boolean;
    recordingActive: boolean;
}) {
    const { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } = getExpoAudioModule()!;
    // Stream remote URLs — downloadFirst contends with CameraX encode on Samsung devices.
    const player = useAudioPlayer(url);
    const status = useAudioPlayerStatus(player);

    useEffect(() => {
        void setAudioModeAsync(REFERENCE_AUDIO_MODE);
    }, [setAudioModeAsync]);

    useEffect(() => {
        if (!recordingActive) {
            return;
        }
        void setAudioModeAsync(REFERENCE_AUDIO_MODE).then(() => {
            if (!active || !status.isLoaded) {
                return;
            }
            try {
                player.play();
            } catch {
                // player may be tearing down
            }
        });
    }, [recordingActive, setAudioModeAsync, active, status.isLoaded, player]);

    useEffect(() => {
        player.loop = true;
    }, [player]);

    useEffect(() => {
        if (!active) {
            try {
                player.pause();
            } catch {
                // player may be tearing down
            }
            return;
        }
        if (!status.isLoaded) {
            return;
        }
        try {
            player.play();
        } catch {
            // player may be tearing down
        }
    }, [player, active, status.isLoaded]);

    return null;
}
