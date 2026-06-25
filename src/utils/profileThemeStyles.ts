import type { FlipProfileTheme } from '@/atproto/profileTheme';
import { ViewStyle } from 'react-native';

const DEFAULT_ACCENT = '#22D3EE';

/** Background style for profile screens when a custom theme is set. */
export function profileBackgroundStyle(
    theme: FlipProfileTheme | null | undefined,
): ViewStyle | undefined {
    const bg = theme?.backgroundColor?.trim();
    return bg ? { backgroundColor: bg } : undefined;
}

/** Accent color for spinners and highlights on profile screens. */
export function profileAccentColor(
    theme: FlipProfileTheme | null | undefined,
    fallback = DEFAULT_ACCENT,
): string {
    return theme?.accentColor?.trim() || fallback;
}
