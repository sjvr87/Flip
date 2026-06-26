import { MENTION_HANDLE_COLOR } from '@/constants/loopsPalette';
import { ensureQueueMicrotask } from '@/utils/safeQueueMicrotask';
import React from 'react';
import {
    Platform,
    Pressable,
    type GestureResponderEvent,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

/** Props passed by expo-router / bottom-tabs to custom tabBarButton. */
export type FlipTabBarButtonProps = Omit<PressableProps, 'style'> & {
    style?: StyleProp<ViewStyle>;
    href?: string;
    children: React.ReactNode;
};

/**
 * Tab bar button: orange press feedback + queueMicrotask before navigation
 * (Android Hermes tab presses). Uses RN Pressable only — no @react-navigation/*
 * imports so Metro never 500s on missing peer packages.
 */
export function FlipTabBarButton({
    onPress,
    onPressIn,
    onLongPress,
    style,
    children,
    ...rest
}: FlipTabBarButtonProps) {
    const wrap =
        (handler?: (event: GestureResponderEvent) => void) =>
        (event: GestureResponderEvent) => {
            ensureQueueMicrotask();
            handler?.(event);
        };

    return (
        <Pressable
            {...rest}
            onPressIn={wrap(onPressIn)}
            onPress={wrap(onPress)}
            onLongPress={wrap(onLongPress)}
            android_ripple={
                Platform.OS === 'android'
                    ? { color: `${MENTION_HANDLE_COLOR}44`, borderless: true }
                    : undefined
            }
            style={({ pressed }) => [
                style,
                Platform.OS === 'ios' && pressed ? { opacity: 0.75 } : null,
                Platform.OS === 'android' && pressed
                    ? { backgroundColor: 'rgba(255, 159, 67, 0.28)' }
                    : null,
            ]}>
            {children}
        </Pressable>
    );
}
