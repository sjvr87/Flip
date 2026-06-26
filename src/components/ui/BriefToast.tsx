import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
    message: string | null;
    onHidden?: () => void;
    durationMs?: number;
};

export function BriefToast({ message, onHidden, durationMs = 1400 }: Props) {
    const insets = useSafeAreaInsets();
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (!message) {
            opacity.value = 0;
            return;
        }

        opacity.value = withTiming(1, { duration: 120 });
        const hideTimer = setTimeout(() => {
            opacity.value = withTiming(0, { duration: 180 }, (finished) => {
                if (finished && onHidden) {
                    runOnJS(onHidden)();
                }
            });
        }, durationMs);

        return () => clearTimeout(hideTimer);
    }, [message, durationMs, onHidden, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    if (!message) {
        return null;
    }

    return (
        <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 88 }]}>
            <Animated.View style={[styles.pill, animatedStyle]}>
                <Text style={styles.text}>{message}</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
    },
    pill: {
        backgroundColor: 'rgba(24, 24, 24, 0.92)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
