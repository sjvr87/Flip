import { Platform } from 'react-native';

/** Flip tab bar icon row (excludes system navigation inset). */
export const TAB_BAR_CONTENT_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

/** Total tab bar height including home indicator / Android gesture nav inset. */
export function getTabBarHeight(bottomInset: number): number {
    if (Platform.OS === 'ios') {
        return TAB_BAR_CONTENT_HEIGHT + Math.max(bottomInset, 21);
    }
    return TAB_BAR_CONTENT_HEIGHT + bottomInset;
}

/** Tab bar style height + padding for expo-router Tabs `tabBarStyle`. */
export function getTabBarStyleInsets(bottomInset: number) {
    if (Platform.OS === 'ios') {
        const inset = Math.max(bottomInset, 21);
        return {
            height: TAB_BAR_CONTENT_HEIGHT + inset,
            paddingBottom: inset,
        };
    }
    return {
        height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
        paddingBottom: Math.max(bottomInset, 8),
    };
}
