import { useMemo } from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Uniform semi-transparent scrim on Home feed tab bar (icons + system nav inset). */
export const TAB_BAR_HOME_OVERLAY_BG = 'rgba(0, 0, 0, 0.5)';
export const TAB_BAR_SOLID_BG_DARK = 'rgba(0, 0, 0, 0.96)';
export const TAB_BAR_SOLID_BG_LIGHT = 'rgba(255, 255, 255, 0.98)';

/** Flip tab icon row — layout chrome only; system nav uses `insets.bottom`. */
export const TAB_BAR_PADDING_TOP = 0;
/** Matches `TAB_ICON_SLOT_SIZE` in `(tabs)/_layout.tsx`. */
export const TAB_BAR_ICON_ROW_HEIGHT = 42;

/** @deprecated Prefer `useFlipTabBarMetrics().contentHeight` */
export const TAB_BAR_CONTENT_HEIGHT = TAB_BAR_ICON_ROW_HEIGHT;

export type FlipTabBarMetrics = {
    /** Raw `useSafeAreaInsets().bottom` — respects Good Lock / gesture / 3-button nav. */
    bottomInset: number;
    paddingTop: number;
    paddingBottom: number;
    contentHeight: number;
    /** Full Flip tab bar footprint from the screen bottom (icons + system nav inset). */
    totalHeight: number;
    /** Bottom offset for feed captions / metadata. */
    feedOverlayBottom: number;
    /** Bottom offset for the right-hand action rail. */
    actionRailBottom: number;
};

export function computeFlipTabBarMetrics(bottomInset: number): FlipTabBarMetrics {
    const paddingTop = TAB_BAR_PADDING_TOP;
    const paddingBottom = bottomInset;
    const contentHeight = TAB_BAR_ICON_ROW_HEIGHT;
    const totalHeight = paddingTop + contentHeight + paddingBottom;

    return {
        bottomInset,
        paddingTop,
        paddingBottom,
        contentHeight,
        totalHeight,
        feedOverlayBottom: totalHeight + 10,
        actionRailBottom: totalHeight + 20,
    };
}

/**
 * Live tab bar metrics from SafeAreaProvider.
 * Recomputes when Good Lock or system nav mode changes inset height.
 */
export function useFlipTabBarMetrics(): FlipTabBarMetrics {
    const insets = useSafeAreaInsets();
    return useMemo(
        () => computeFlipTabBarMetrics(insets.bottom),
        [insets.bottom],
    );
}

/** Tab bar style for expo-router `Tabs` `tabBarStyle`. */
export function getTabBarStyleFromMetrics(metrics: FlipTabBarMetrics) {
    return {
        paddingTop: metrics.paddingTop,
        paddingBottom: metrics.paddingBottom,
        height: metrics.totalHeight,
    };
}

export type FlipTabBarVariant = 'home' | 'solid';

/** Shared tab bar chrome — height, insets, and home vs solid background. */
export function getFlipTabBarStyle(
    metrics: FlipTabBarMetrics,
    variant: FlipTabBarVariant,
    isDark: boolean,
    borderColor: string,
): ViewStyle {
    const layout = getTabBarStyleFromMetrics(metrics);
    const sizing =
        Platform.OS === 'android'
            ? { minHeight: layout.height }
            : { height: layout.height };

    const base: ViewStyle = {
        paddingTop: layout.paddingTop,
        paddingBottom: layout.paddingBottom,
        ...sizing,
        elevation: 0,
        shadowOpacity: 0,
    };

    if (variant === 'home') {
        return {
            ...base,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
        };
    }

    return {
        ...base,
        backgroundColor: isDark ? TAB_BAR_SOLID_BG_DARK : TAB_BAR_SOLID_BG_LIGHT,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: borderColor,
    };
}

/** @deprecated Use `useFlipTabBarMetrics` or `computeFlipTabBarMetrics` */
export function getTabBarHeight(bottomInset: number): number {
    return computeFlipTabBarMetrics(bottomInset).totalHeight;
}

/** @deprecated Use `getTabBarStyleFromMetrics` */
export function getTabBarStyleInsets(bottomInset: number) {
    const metrics = computeFlipTabBarMetrics(bottomInset);
    return {
        height: metrics.totalHeight,
        paddingBottom: metrics.paddingBottom,
    };
}
