import { squircleRadiusForSize } from '@/constants/avatarTokens';
import { Storage } from '@/utils/cache';
import { Image, ImageProps } from 'expo-image';
import { router } from 'expo-router';
import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';

/**
 * Reusable Avatar component built on expo-image.
 * - Default shape is squircle (rounded square, matching the video feed).
 * - Clickable via `href` (expo-router) or `onPress`.
 * - Theming support for size, radius and border.
 * - Hardcoded fallback URL if loading fails.
 */

// Hardcoded fallback URL
const DEFAULT_FALLBACK_URL = 'https://loopsusercontent.com/avatars/default.jpg?v=1';

// Built-in theme presets.
const THEMES = {
    sm: { size: 32, radius: 9999, borderWidth: 0, borderColor: 'transparent' },
    md: { size: 40, radius: 9999, borderWidth: 0, borderColor: 'transparent' },
    lg: { size: 56, radius: 9999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
    xl: { size: 120, radius: 9999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
} as const;

export type AvatarThemeKey = keyof typeof THEMES;
export type AvatarThemeConfig = {
    size?: number;
    radius?: number;
    borderWidth?: number;
    borderColor?: string;
};

export type AvatarShape = 'squircle' | 'circle';

export type AvatarProps = {
    /** Primary image URL */
    url?: string | null;
    /** Shorthand for square size. Height === Width. */
    width?: number;
    /** Alias for `width`. */
    size?: number;
    /** Corner radius (ignored for circle; defaults to proportional squircle). */
    radius?: number;
    /** Avatar corner shape. Defaults to squircle app-wide. */
    shape?: AvatarShape;
    /** @deprecated Use `shape="circle"` instead. When true, forces a circle. */
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

const resolveShape = (
    shape: AvatarShape | undefined,
    rounded: boolean | undefined,
): AvatarShape => {
    if (rounded === true) return 'circle';
    if (shape) return shape;
    if (rounded === false) return 'squircle';
    return 'squircle';
};

const Avatar = memo(function Avatar({
    url,
    width,
    size,
    radius,
    shape,
    rounded,
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

    const avatarSize = width ?? size ?? resolvedTheme.size ?? 40;
    const resolvedShape = resolveShape(shape, rounded);

    const computedRadius =
        resolvedShape === 'circle'
            ? Math.ceil(avatarSize / 2)
            : (radius ?? squircleRadiusForSize(avatarSize));

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
                    width: avatarSize,
                    height: avatarSize,
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
