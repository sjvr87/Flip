import { getExpoAudioModule, isExpoAudioAvailable } from '@/utils/expoAudioAvailability';
import { useEffect } from 'react';

type ReferenceAudioPlayerProps = {
    url: string;
    active?: boolean;
};

/** Audio-only playback for remix/create flows (no VideoView — avoids camera decoder conflicts on Android). */
export default function ReferenceAudioPlayer({ url, active = true }: ReferenceAudioPlayerProps) {
    if (!isExpoAudioAvailable() || !url) {
        return null;
    }

    return <ReferenceAudioPlayerActive url={url} active={active} />;
}

function ReferenceAudioPlayerActive({ url, active }: { url: string; active: boolean }) {
    const { useAudioPlayer, setAudioModeAsync } = getExpoAudioModule()!;
    const player = useAudioPlayer(url, { downloadFirst: true });

    useEffect(() => {
        void setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
        });
    }, [setAudioModeAsync]);

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
