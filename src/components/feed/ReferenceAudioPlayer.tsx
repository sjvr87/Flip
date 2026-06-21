import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';

type ReferenceAudioPlayerProps = {
    url: string;
    active?: boolean;
};

/** Audio-only playback for remix/create flows (no VideoView — avoids camera decoder conflicts on Android). */
export default function ReferenceAudioPlayer({ url, active = true }: ReferenceAudioPlayerProps) {
    const player = useAudioPlayer(url, { downloadFirst: true });

    useEffect(() => {
        void setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
        });
    }, []);

    useEffect(() => {
        player.loop = true;
    }, [player]);

    useEffect(() => {
        try {
            if (active) {
                player.play();
            } else {
                player.pause();
            }
        } catch {
            // player may be tearing down
        }
    }, [player, active]);

    return null;
}
