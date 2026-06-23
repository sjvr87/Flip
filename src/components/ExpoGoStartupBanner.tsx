import Constants from 'expo-constants';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Tiny on-screen proof that JS executed (Expo Go only). Auto-hides after a few seconds. */
export function ExpoGoStartupBanner({ visible }: { visible: boolean }) {
    useEffect(() => {
        if (!visible) return;
        console.warn(
            `[startup] Expo Go banner — sdk=${Constants.expoConfig?.sdkVersion ?? '?'} ownership=${Constants.appOwnership}`,
        );
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={styles.banner} pointerEvents="none">
            <Text style={styles.text}>
                Flip · Expo Go · SDK {Constants.expoConfig?.sdkVersion ?? '?'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        top: 48,
        left: 12,
        right: 12,
        zIndex: 10000,
        backgroundColor: 'rgba(37, 99, 235, 0.92)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    text: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
});
