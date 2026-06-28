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
    useState,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import tw, { useDeviceContext } from 'twrnc';

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

function resolveColorScheme(
    preference: ColorScheme,
    systemColorScheme: 'light' | 'dark' | null | undefined,
): ResolvedColorScheme {
    if (preference === 'device') {
        return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return preference;
}

export const ThemeProvider = (props: PropsWithChildren) => {
    const [preference, setPreference] = useState<ColorScheme>(() => readPersistedColorScheme());
    const systemColorScheme = useSystemColorScheme();

    const resolvedColorScheme = useMemo(
        () => resolveColorScheme(preference, systemColorScheme),
        [preference, systemColorScheme],
    );

    // twrnc only understands light/dark — never pass the literal string "device".
    useDeviceContext(tw, {
        observeDeviceColorSchemeChanges: false,
        initialColorScheme: resolveColorScheme(readPersistedColorScheme(), systemColorScheme),
    });

    const [, setTwRevision] = useState(0);

    useEffect(() => {
        tw.setColorScheme(resolvedColorScheme);
        setTwRevision((revision) => revision + 1);
    }, [resolvedColorScheme]);

    const isDark = resolvedColorScheme === 'dark';
    const colors = useMemo(() => getLoopsColors(isDark), [isDark]);
    const skipFirstPersist = useRef(true);

    const setColorScheme = useCallback((scheme: ColorScheme) => {
        setPreference(scheme);
        storage.set('colorScheme', scheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setPreference((current) => {
            const resolved = resolveColorScheme(current, systemColorScheme);
            const next: ColorScheme = resolved === 'dark' ? 'light' : 'dark';
            storage.set('colorScheme', next);
            return next;
        });
    }, [systemColorScheme]);

    useEffect(() => {
        if (skipFirstPersist.current) {
            skipFirstPersist.current = false;
            return;
        }
        storage.set('colorScheme', preference);
    }, [preference]);

    useEffect(() => {
        useThemeStore.getState().setMode(resolvedColorScheme);
    }, [resolvedColorScheme]);

    return (
        <ThemeContext.Provider
            value={{
                colorScheme: preference,
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
