import { createVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

type ReferenceAudioPlayerProps = {
    url: string;
    active?: boolean;
};

/** Hidden player so remix/create flows can hear the source clip while recording. */
export default function ReferenceAudioPlayer({ url, active = true }: ReferenceAudioPlayerProps) {
    const playerRef = useRef<ReturnType<typeof createVideoPlayer> | null>(null);
    const [player, setPlayer] = useState<ReturnType<typeof createVideoPlayer> | null>(null);

    useEffect(() => {
        if (!url) {
            return;
        }

        const nextPlayer = createVideoPlayer(url);
        nextPlayer.loop = true;
        nextPlayer.muted = false;
        playerRef.current = nextPlayer;
        setPlayer(nextPlayer);

        return () => {
            try {
                nextPlayer.pause();
                nextPlayer.release?.();
            } catch {
                // already released
            }
            if (playerRef.current === nextPlayer) {
                playerRef.current = null;
            }
        };
    }, [url]);

    useEffect(() => {
        if (!player) {
            return;
        }
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

    if (!player) {
        return null;
    }

    return (
        <View style={styles.hidden} pointerEvents="none" accessible={false}>
            <VideoView
                player={player}
                style={styles.hidden}
                nativeControls={false}
                allowsPictureInPicture={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    hidden: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        overflow: 'hidden',
    },
});
