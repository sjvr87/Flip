import { useMemo } from 'react';
import { PixelRatio, Platform, StatusBar, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Semi-transparent scrim on Home feed tab bar icon row only. */
export const TAB_BAR_HOME_OVERLAY_BG = 'rgba(0, 0, 0, 0.5)';
/** Solid fill under icons (system nav inset) — matches video letterbox black. */
export const TAB_BAR_HOME_NAV_BG = '#000';
export const TAB_BAR_SOLID_BG_DARK = 'rgba(0, 0, 0, 0.96)';
export const TAB_BAR_SOLID_BG_LIGHT = 'rgba(255, 255, 255, 0.98)';

/** Flip tab icon row — layout chrome only; system nav uses `insets.bottom`. */
export const TAB_BAR_PADDING_TOP = 0;
/** Matches `TAB_ICON_SLOT_SIZE` in `(tabs)/_layout.tsx`. */
export const TAB_BAR_ICON_ROW_HEIGHT = 42;

/** Create-tab FLIP–IT label span in its 26×26 viewBox — home scrim + feed letterbox align here. */
const CREATE_TAB_VIEWBOX = 26;
const CREATE_FLIP_LABEL_BASELINE = 3.7;
const CREATE_IT_LABEL_BASELINE = 24.1;
const CREATE_LABEL_FONT_SIZE = 5.0;

/** Ink top of “FLIP” through ink bottom of “IT” (Create tab icon), in viewBox units. */
export function getTabBarIconOpticalSpanVb(): number {
    const labelTop = CREATE_FLIP_LABEL_BASELINE - CREATE_LABEL_FONT_SIZE;
    const labelBottom = CREATE_IT_LABEL_BASELINE + CREATE_LABEL_FONT_SIZE * 0.2;
    return labelBottom - labelTop;
}

/** Pixel height from FLIP top to IT bottom at the standard tab icon slot size. */
export function getTabBarIconOpticalHeight(
    slotSize = TAB_BAR_ICON_ROW_HEIGHT,
): number {
    return Math.round(slotSize * (getTabBarIconOpticalSpanVb() / CREATE_TAB_VIEWBOX));
}
/** Lift icons above the system nav / gesture bar (Samsung edge-to-edge). */
const TAB_BAR_ICON_LIFT_DP = Platform.OS === 'android' ? 8 : 4;
/** When SafeAreaProvider reports 0, gesture nav still needs clearance. */
const ANDROID_MIN_NAV_INSET_DP = 28;

function resolveTabBarBottomInset(rawBottomInset: number): number {
    if (Platform.OS !== 'android') {
        return rawBottomInset;
    }
    const minPx = PixelRatio.roundToNearestPixel(ANDROID_MIN_NAV_INSET_DP);
    const tiny = PixelRatio.roundToNearestPixel(8);
    if (rawBottomInset < tiny) {
        return minPx;
    }
    return rawBottomInset;
}

function resolveTabBarIconLift(): number {
    return PixelRatio.roundToNearestPixel(TAB_BAR_ICON_LIFT_DP);
}

/** @deprecated Prefer `useFlipTabBarMetrics().contentHeight` */
export const TAB_BAR_CONTENT_HEIGHT = TAB_BAR_ICON_ROW_HEIGHT;

export type FlipTabBarMetrics = {
    /** Raw `useSafeAreaInsets().bottom` — respects Good Lock / gesture / 3-button nav. */
    bottomInset: number;
    paddingTop: number;
    paddingBottom: number;
    /** Extra gap between icon row and system nav (tab item margin). */
    iconLift: number;
    contentHeight: number;
    /** Icon row only — feed video `bottom` inset (excludes system nav padding). */
    feedVideoBottomReserved: number;
    /** Full Flip tab bar footprint from the screen bottom (icons + system nav inset). */
    totalHeight: number;
    /** Bottom offset for feed captions / metadata. */
    feedOverlayBottom: number;
    /** Bottom offset for the right-hand action rail. */
    actionRailBottom: number;
};

export function computeFlipTabBarMetrics(bottomInset: number): FlipTabBarMetrics {
    const paddingTop = TAB_BAR_PADDING_TOP;
    const iconLift = resolveTabBarIconLift();
    const paddingBottom = resolveTabBarBottomInset(bottomInset);
    const contentHeight = TAB_BAR_ICON_ROW_HEIGHT;
    const totalHeight = paddingTop + contentHeight + iconLift + paddingBottom;

    return {
        bottomInset,
        paddingTop,
        paddingBottom,
        iconLift,
        contentHeight,
        feedVideoBottomReserved: getTabBarIconOpticalHeight(contentHeight),
        totalHeight,
        feedOverlayBottom: totalHeight + 10,
        actionRailBottom: totalHeight + 20,
    };
}

/** Fallback when `StatusBar.currentHeight` is unavailable (classic 24dp icon row). */
const ANDROID_STATUS_ICON_ROW_DP = 24;

/**
 * Status bar band + feed video top inset.
 * Android feed: match the OS status bar frame (clock/battery/signal row) exactly.
 * Do not use SafeAreaProvider top — Samsung punch-hole safe area inflates (~149px).
 */
export function getFeedStatusBarTopInset(safeAreaTop: number): number {
    if (Platform.OS !== 'android') {
        return safeAreaTop;
    }

    const iconRowPx = PixelRatio.roundToNearestPixel(ANDROID_STATUS_ICON_ROW_DP);
    const frameHeight = StatusBar.currentHeight;

    if (frameHeight != null && frameHeight > 0) {
        // Flush with system status icons — OS status bar height, never punch-hole safe area.
        return frameHeight;
    }

    return iconRowPx;
}

/**
 * Live tab bar metrics from SafeAreaProvider.
 * Recomputes when Good Lock or system nav mode changes inset height.
 */
export function useFlipTabBarMetrics(): FlipTabBarMetrics {
    const insets = useSafeAreaInsets();
    return useMemo(() => computeFlipTabBarMetrics(insets.bottom), [insets.bottom]);
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

    const base: ViewStyle = {
        paddingTop: layout.paddingTop,
        paddingBottom: layout.paddingBottom,
        height: layout.height,
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
            backgroundColor: TAB_BAR_HOME_NAV_BG,
            borderTopWidth: 0,
            overflow: 'visible',
        };
    }

    return {
        ...base,
        backgroundColor: isDark ? TAB_BAR_SOLID_BG_DARK : TAB_BAR_SOLID_BG_LIGHT,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: borderColor,
    };
}

/** Middle-band video area between status bar and tab bar icon row (home feed). */
export type FeedVideoViewport = {
    /** Status icon row height — from `getFeedStatusBarTopInset`. */
    topInset: number;
    /** Tab icon row only (`FlipTabBarMetrics.feedVideoBottomReserved`). */
    bottomReserved: number;
    /** Height available for cover-fit video (`windowHeight - topInset - bottomReserved`). */
    viewportHeight: number;
};

export function computeFeedVideoViewport(
    windowHeight: number,
    safeAreaTop: number,
    tabBarContentHeight: number,
): FeedVideoViewport {
    const topInset = getFeedStatusBarTopInset(safeAreaTop);
    const bottomReserved = tabBarContentHeight;
    const viewportHeight = Math.max(0, Math.round(windowHeight - topInset - bottomReserved));
    return { topInset, bottomReserved, viewportHeight };
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
