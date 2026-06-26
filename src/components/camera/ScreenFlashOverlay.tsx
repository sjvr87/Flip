import { useCallback, useRef } from 'react';
import { NativeModules, StyleSheet } from 'react-native';
import Animated, {
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

/**
 * Warm-white screen flash overlay for the front-facing camera.
 *
 * When activated the screen brightness is maxed out and a warm semi-transparent
 * overlay fades in, acting as a soft fill light (like Snapchat / Instagram).
 * The overlay color is a warm off-white (#FFF5E0) at ~85 % opacity so it
 * illuminates the face without washing out skin tones.
 *
 * Brightness is boosted via the platform-level window API so no extra
 * dependency (expo-brightness) is needed.
 */

const FLASH_COLOR = 'rgba(255,245,224,0.85)';
const FADE_IN_MS = 120;
const FADE_OUT_MS = 200;

/**
 * Boost / restore screen brightness using the platform-level window API.
 * We access this through the RNBrightness module if available, otherwise
 * it's a no-op and the overlay alone provides illumination.
 */
let savedBrightness: number | null = null;

function getBrightnessModule() {
    return NativeModules.RNBrightness ?? NativeModules.ExpoBrightness ?? null;
}

async function boostBrightness() {
    try {
        const mod = getBrightnessModule();
        if (!mod) return;
        if (typeof mod.getBrightness === 'function') {
            savedBrightness = await mod.getBrightness();
        } else if (typeof mod.getSystemBrightnessAsync === 'function') {
            savedBrightness = await mod.getSystemBrightnessAsync();
        }
        if (typeof mod.setBrightness === 'function') {
            await mod.setBrightness(1);
        } else if (typeof mod.setBrightnessAsync === 'function') {
            await mod.setBrightnessAsync(1);
        }
    } catch {
        // Non-critical — the overlay itself provides fill light.
    }
}

async function restoreBrightness() {
    try {
        if (savedBrightness === null) return;
        const mod = getBrightnessModule();
        if (!mod) {
            savedBrightness = null;
            return;
        }
        const target = savedBrightness;
        savedBrightness = null;
        if (typeof mod.setBrightness === 'function') {
            await mod.setBrightness(target);
        } else if (typeof mod.setBrightnessAsync === 'function') {
            await mod.setBrightnessAsync(target);
        }
    } catch {
        savedBrightness = null;
    }
}

export function useScreenFlash() {
    const opacity = useSharedValue(0);
    const opacityRef = useRef(opacity);
    const activeRef = useRef(false);

    /** One-shot flash for photo capture. */
    const fireFlash = useCallback((durationMs = 500) => {
        if (activeRef.current) return;
        activeRef.current = true;
        const sv = opacityRef.current;
        void boostBrightness();
        sv.value = withTiming(1, { duration: FADE_IN_MS });

        // Hold at full brightness, then fade out.
        setTimeout(() => {
            sv.value = withTiming(0, { duration: FADE_OUT_MS });
            setTimeout(() => {
                activeRef.current = false;
                void restoreBrightness();
            }, FADE_OUT_MS);
        }, FADE_IN_MS + durationMs);
    }, []);

    /** Hold flash on (for video recording). Call `stopFlash` to release. */
    const startFlash = useCallback(() => {
        if (activeRef.current) return;
        activeRef.current = true;
        void boostBrightness();
        opacityRef.current.value = withTiming(1, { duration: FADE_IN_MS });
    }, []);

    const stopFlash = useCallback(() => {
        if (!activeRef.current) return;
        activeRef.current = false;
        opacityRef.current.value = withTiming(0, { duration: FADE_OUT_MS });
        void restoreBrightness();
    }, []);

    return { opacity, fireFlash, startFlash, stopFlash };
}

export function ScreenFlashOverlay({ opacity }: { opacity: SharedValue<number> }) {
    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return <Animated.View style={[styles.overlay, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: FLASH_COLOR,
        zIndex: 999,
    },
});
