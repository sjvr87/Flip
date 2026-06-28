import { Storage } from '@/utils/cache';
import { squircleRadius, AVATAR_SIZE } from '@/utils/avatarShape';
import { Image, ImageProps } from 'expo-image';
import { router } from 'expo-router';
import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';

/**
 * Reusable Avatar component built on expo-image.
 * - Clickable via `href` (expo-router) or `onPress`.
 * - Theming support for size, radius and border.
 * - Hardcoded fallback URL if loading fails.
 */

// Hardcoded fallback URL
const DEFAULT_FALLBACK_URL = 'https://loopsusercontent.com/avatars/default.jpg?v=1';

// Built-in theme presets — radius always from squircleRadius(size) at render time.
const THEMES = {
    sm: { size: AVATAR_SIZE.comment, borderWidth: 0, borderColor: 'transparent' },
    md: { size: 40, borderWidth: 0, borderColor: 'transparent' },
    lg: { size: 56, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
    xl: { size: AVATAR_SIZE.profile, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
} as const;

export type AvatarThemeKey = keyof typeof THEMES;
export type AvatarThemeConfig = {
    size?: number;
    borderWidth?: number;
    borderColor?: string;
};

export type AvatarProps = {
    /** Primary image URL */
    url?: string | null;
    /** Shorthand for square size. Height === Width. */
    width?: number;
    /** Alias for `width`. */
    size?: number;
    /** Corner radius when `rounded` is false (defaults to squircle for size). */
    radius?: number;
    /** If true, perfect circle. Default false — squircle avatars app-wide. */
    rounded?: boolean;
    /** Border width in dp. */
    borderWidth?: number;
    /** Border color. */
    borderColor?: string;
    /** Theme preset name or a custom object. */
    theme?: AvatarThemeKey | AvatarThemeConfig;
    /** Route to push via expo-router (used if onPress is not provided). */
    href?: string;
    /** Optional press callback. Takes precedence over `href`. */
    onPress?: () => void;
    /** Optional long-press callback. */
    onLongPress?: () => void;
    /** Accessibility label for screen readers. */
    accessibilityLabel?: string;
    /** Disable press interactions. */
    disabled?: boolean;
    /** Optional style override. */
    style?: ViewStyle;
    /** Hit area expansion for touch targets. */
    hitSlop?: number | { top?: number; right?: number; bottom?: number; left?: number };
    /** expo-image props passthrough (limited, see pick below). */
    contentFit?: ImageProps['contentFit'];
    transition?: ImageProps['transition'];
    cachePolicy?: ImageProps['cachePolicy'];
    placeholder?: ImageProps['placeholder'];
    /** Optional override for the fallback image URL (defaults to DEFAULT_FALLBACK_URL). */
    fallbackUrl?: string;
    testID?: string;
};

const pickTheme = (theme?: AvatarThemeKey | AvatarThemeConfig) => {
    if (!theme) return THEMES.md;
    if (typeof theme === 'string') return THEMES[theme] ?? THEMES.md;
    return { ...THEMES.md, ...theme };
};

const Avatar = memo(function Avatar({
    url,
    width,
    size,
    radius,
    rounded = false,
    borderWidth,
    borderColor,
    theme,
    href,
    onPress,
    onLongPress,
    accessibilityLabel = 'Avatar',
    disabled,
    style,
    hitSlop = 6,
    contentFit = 'cover',
    transition = 120,
    cachePolicy = 'memory-disk',
    placeholder,
    fallbackUrl,
    testID,
}: AvatarProps) {
    const [failed, setFailed] = useState(false);

    const resolvedTheme = useMemo(() => pickTheme(theme), [theme]);

    const dimension = width ?? size ?? resolvedTheme.size ?? 40;

    const computedRadius = rounded
        ? Math.ceil(dimension / 2)
        : (radius ?? squircleRadius(dimension));

    const finalBorderWidth = borderWidth ?? resolvedTheme.borderWidth ?? 0;
    const finalBorderColor = borderColor ?? resolvedTheme.borderColor ?? 'transparent';

    const computedFallbackUrl = useMemo(() => {
        if (fallbackUrl) {
            return fallbackUrl;
        }

        const domain = Storage.getString('app.instance');
        try {
            return `https://${domain}/storage/avatars/default.jpg`;
        } catch (e) {
            return DEFAULT_FALLBACK_URL;
        }
    }, [fallbackUrl]);

    const source =
        failed || !url ? { uri: fallbackUrl || computedFallbackUrl } : { uri: String(url) };

    const pressable = Boolean(onPress || href);

    const child = (
        <Image
            source={source}
            onError={() => setFailed(true)}
            contentFit={contentFit}
            cachePolicy={cachePolicy}
            transition={transition}
            placeholder={placeholder}
            accessibilityLabel={accessibilityLabel}
            style={[
                styles.base,
                {
                    width: dimension,
                    height: dimension,
                    borderRadius: computedRadius,
                    borderWidth: finalBorderWidth,
                    borderColor: finalBorderColor,
                },
                style,
            ]}
            testID={testID}
        />
    );

    if (!pressable) return child;

    const handlePress = () => {
        if (disabled) return;
        if (onPress) return onPress();
        if (href) router.push(href);
    };

    return (
        <Pressable
            onPress={handlePress}
            onLongPress={onLongPress}
            disabled={disabled}
            hitSlop={hitSlop}
            android_ripple={{ borderless: true }}
            accessibilityRole="imagebutton"
            accessibilityLabel={accessibilityLabel}
            style={({ pressed }) => [
                { opacity: pressed ? 0.86 : 1 },
                // Preserve any layout/positioning from consumer's style prop
                // when wrapping with Pressable
                style as ViewStyle,
            ]}>
            {child}
        </Pressable>
    );
});

const styles = StyleSheet.create({
    base: {
        backgroundColor: 'rgba(0,0,0,0.04)',
        overflow: 'hidden',
    },
});

export default Avatar;
