import { useThemeStore } from '@/components/ui/useThemeStore';
import { getLoopsColors, type LoopsThemeColors } from '@/constants/loopsPalette';
import { Storage } from '@/utils/cache';
import React, {
    PropsWithChildren,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import tw, { useAppColorScheme, useDeviceContext } from 'twrnc';

export const storage = Storage;

export type ColorScheme = 'light' | 'dark' | 'device';
export type ResolvedColorScheme = 'light' | 'dark';

type ThemeContextType = {
    colorScheme: ColorScheme;
    resolvedColorScheme: ResolvedColorScheme;
    isDark: boolean;
    colors: LoopsThemeColors;
    toggleTheme: () => void;
    setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readPersistedColorScheme(): ColorScheme {
    const saved = storage.getString('colorScheme');
    if (saved === 'light' || saved === 'dark' || saved === 'device') {
        return saved;
    }
    return 'device';
}

export const ThemeProvider = (props: PropsWithChildren) => {
    const initialColorScheme = useMemo(() => readPersistedColorScheme(), []);

    useDeviceContext(tw, {
        observeDeviceColorSchemeChanges: true,
        initialColorScheme,
    });

    const [colorScheme, toggleColorScheme, setTwrncColorScheme] = useAppColorScheme(tw);
    const systemColorScheme = useSystemColorScheme();

    const resolvedColorScheme = useMemo<ResolvedColorScheme>(() => {
        if (colorScheme === 'device') {
            return systemColorScheme === 'dark' ? 'dark' : 'light';
        }
        return colorScheme;
    }, [colorScheme, systemColorScheme]);

    const isDark = resolvedColorScheme === 'dark';
    const colors = useMemo(() => getLoopsColors(isDark), [isDark]);
    const skipFirstPersist = useRef(true);

    const setColorScheme = useCallback(
        (scheme: ColorScheme) => {
            setTwrncColorScheme(scheme);
        },
        [setTwrncColorScheme],
    );

    const toggleTheme = useCallback(() => {
        toggleColorScheme();
    }, [toggleColorScheme]);

    useEffect(() => {
        if (skipFirstPersist.current) {
            skipFirstPersist.current = false;
            return;
        }
        storage.set('colorScheme', colorScheme as string);
    }, [colorScheme]);

    useEffect(() => {
        useThemeStore.getState().setMode(resolvedColorScheme);
    }, [resolvedColorScheme]);

    return (
        <ThemeContext.Provider
            value={{
                colorScheme: colorScheme as ColorScheme,
                resolvedColorScheme,
                isDark,
                colors,
                toggleTheme,
                setColorScheme,
            }}>
            {props.children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
};
