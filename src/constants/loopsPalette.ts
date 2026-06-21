/**
 * Loops-inspired design tokens for light and dark mode.
 * Accent cyan (#22D3EE) is shared across themes.
 */

export const LOOP_ACCENT = '#22D3EE';
export const LOOP_ACCENT_PRESSED = '#06B6D4';

/** `@` symbol in @mentions (blue). */
export const MENTION_AT_COLOR = '#3B82F6';
/** Username/handle in @mentions (creamsicle orange). */
export const MENTION_HANDLE_COLOR = '#FF9F43';

export type LoopsThemeColors = {
    accent: string;
    accentPressed: string;
    background: string;
    surface: string;
    surfaceElevated: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    tabBar: string;
    tabBarBorder: string;
    tabIconActive: string;
    tabIconInactive: string;
    inputBackground: string;
    inputBorder: string;
    placeholder: string;
    modalBackground: string;
    card: string;
};

export const loopsLight: LoopsThemeColors = {
    accent: LOOP_ACCENT,
    accentPressed: LOOP_ACCENT_PRESSED,
    background: '#ffffff',
    surface: '#f9fafb',
    surfaceElevated: '#f3f4f6',
    border: '#e5e7eb',
    text: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    tabBar: '#ffffff',
    tabBarBorder: '#eeeeee',
    tabIconActive: '#000000',
    tabIconInactive: '#999999',
    inputBackground: '#ffffff',
    inputBorder: '#d1d5db',
    placeholder: '#9ca3af',
    modalBackground: '#ffffff',
    card: '#f3f4f6',
};

export const loopsDark: LoopsThemeColors = {
    accent: LOOP_ACCENT,
    accentPressed: LOOP_ACCENT_PRESSED,
    background: '#000000',
    surface: '#121212',
    surfaceElevated: '#1c1c1e',
    border: '#2c2c2e',
    text: '#ffffff',
    textSecondary: '#a1a1a6',
    textMuted: '#636366',
    tabBar: '#000000',
    tabBarBorder: '#1e2939',
    tabIconActive: '#ffffff',
    tabIconInactive: '#555555',
    inputBackground: '#1c1c1e',
    inputBorder: '#3a3a3c',
    placeholder: '#666666',
    modalBackground: '#000000',
    card: '#1c1c1e',
};

export function getLoopsColors(isDark: boolean): LoopsThemeColors {
    return isDark ? loopsDark : loopsLight;
}
