import { getExpoAudioModule, isExpoAudioAvailable } from '@/utils/expoAudioAvailability';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type ReferenceAudioPlayerProps = {
    url: string;
    active?: boolean;
};

/** Configured once before CameraX record — re-applying on record start races mic capture and freezes preview. */
const REFERENCE_AUDIO_MODE = {
    playsInSilentMode: true,
    allowsRecording: true,
    interruptionMode: 'mixWithOthers' as const,
};

/** Audio-only playback for remix/create flows (no VideoView — avoids camera decoder conflicts on Android). */
export default function ReferenceAudioPlayer({
    url,
    active = true,
}: ReferenceAudioPlayerProps) {
    if (!isExpoAudioAvailable() || !url) {
        if (__DEV__ && url) {
            console.warn('[ReferenceAudio] expo-audio native module unavailable');
        }
        return null;
    }

    return <ReferenceAudioPlayerActive url={url} active={active} />;
}

function ReferenceAudioPlayerActive({
    url,
    active,
}: {
    url: string;
    active: boolean;
}) {
    const { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } = getExpoAudioModule()!;
    // Stream remote URLs — downloadFirst contends with CameraX encode on Samsung devices.
    const player = useAudioPlayer(url);
    const status = useAudioPlayerStatus(player);
    const loggedPlaying = useRef(false);

    useEffect(() => {
        if (__DEV__) {
            console.log('[ReferenceAudio] mount', {
                url: url.slice(0, 80),
                active,
                platform: Platform.OS,
            });
        }
    }, [url, active]);

    useEffect(() => {
        void setAudioModeAsync(REFERENCE_AUDIO_MODE);
    }, [setAudioModeAsync]);

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
            if (__DEV__ && !loggedPlaying.current) {
                loggedPlaying.current = true;
                console.log('[ReferenceAudio] playing', url.slice(0, 80));
            }
        } catch (error) {
            if (__DEV__) {
                console.warn('[ReferenceAudio] play failed:', error);
            }
        }
    }, [player, active, status.isLoaded, url]);

    return null;
}
