import { MENTION_HANDLE_COLOR } from '@/constants/loopsPalette';
import { ensureQueueMicrotask } from '@/utils/safeQueueMicrotask';
import { PlatformPressable } from 'expo-router/react-navigation';
import type { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import React from 'react';
import { Platform } from 'react-native';

/**
 * Tab bar button: cyan active icons (from tabBarActiveTintColor) + orange press feedback.
 * Re-applies queueMicrotask before navigation — required on Android Hermes tab presses.
 */
export function FlipTabBarButton(props: BottomTabBarButtonProps) {
    const { onPress, onPressIn, onLongPress, ...rest } = props;

    return (
        <PlatformPressable
            {...rest}
            onPressIn={(event) => {
                ensureQueueMicrotask();
                onPressIn?.(event);
            }}
            onPress={(event) => {
                ensureQueueMicrotask();
                onPress?.(event);
            }}
            onLongPress={(event) => {
                ensureQueueMicrotask();
                onLongPress?.(event);
            }}
            pressColor={
                Platform.OS === 'android' ? 'rgba(255, 159, 67, 0.28)' : undefined
            }
            pressOpacity={Platform.OS === 'ios' ? 0.75 : undefined}
            android_ripple={
                Platform.OS === 'android'
                    ? { color: `${MENTION_HANDLE_COLOR}44`, borderless: true }
                    : undefined
            }
        />
    );
}
