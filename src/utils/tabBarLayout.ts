import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Flip tab icon row — layout chrome only; system nav uses `insets.bottom`. */
export const TAB_BAR_PADDING_TOP = 10;
export const TAB_BAR_ICON_ROW_HEIGHT = Platform.OS === 'ios' ? 49 : 48;

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
    // iOS home indicator has a sensible minimum; Android/Samsung — trust SafeAreaProvider only.
    const paddingBottom =
        Platform.OS === 'ios' ? Math.max(bottomInset, 21) : bottomInset;
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
