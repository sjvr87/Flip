import { Storage } from '@/utils/cache';
import React, {
    PropsWithChildren,
    createContext,
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
    toggleTheme: () => void;
    setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = (props: PropsWithChildren) => {
    useDeviceContext(tw, {
        observeDeviceColorSchemeChanges: true,
        initialColorScheme: 'device',
    });

    const [colorScheme, toggleColorScheme, setColorScheme] = useAppColorScheme(tw);
    const systemColorScheme = useSystemColorScheme();

    const resolvedColorScheme = useMemo<ResolvedColorScheme>(() => {
        if (colorScheme === 'device') {
            return systemColorScheme === 'dark' ? 'dark' : 'light';
        }
        return colorScheme;
    }, [colorScheme, systemColorScheme]);

    const isDark = resolvedColorScheme === 'dark';
    const hasRestoredTheme = useRef(false);
    const skipNextPersist = useRef(false);

    useEffect(() => {
        const saved = storage.getString('colorScheme') as ColorScheme | undefined;
        if (saved && saved !== colorScheme) {
            skipNextPersist.current = true;
            setColorScheme(saved);
        }
        hasRestoredTheme.current = true;
    }, []);

    const toggleTheme = () => {
        toggleColorScheme();
    };

    useEffect(() => {
        if (!hasRestoredTheme.current) return;
        if (skipNextPersist.current) {
            skipNextPersist.current = false;
            return;
        }
        storage.set('colorScheme', colorScheme as string);
    }, [colorScheme]);

    return (
        <ThemeContext.Provider
            value={{
                colorScheme: colorScheme as ColorScheme,
                resolvedColorScheme,
                isDark,
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
