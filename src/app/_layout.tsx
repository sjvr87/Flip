import { ExpoGoStartupBanner } from '@/components/ExpoGoStartupBanner';
import { StartupErrorBoundary } from '@/components/StartupErrorBoundary';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { isExpoGo, isWeb, useSafeNativeShims } from '@/utils/runtime';
import { useAuthStore } from '@/utils/authStore';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { type PropsWithChildren, useEffect, useLayoutEffect, useState } from 'react';
import { AppState, LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const SPLASH_FAILSAFE_MS = 10_000;
const EXPO_GO_BANNER_MS = 4000;

if (isExpoGo) {
    LogBox.ignoreLogs(['[startup]']);
}

if (Platform.OS !== 'web' && !isExpoGo) {
    try {
        const Notifications = require('expo-notifications');
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldPlaySound: false,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    } catch (error) {
        console.warn('[startup] Notifications handler setup failed:', error);
    }
}

void SplashScreen.preventAutoHideAsync().catch((error) => {
    console.warn('[startup] SplashScreen.preventAutoHideAsync failed:', error);
});

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 2 } },
});

if (Platform.OS !== 'web') {
    focusManager.setFocused(AppState.currentState === 'active');
    AppState.addEventListener('change', (status) => {
        focusManager.setFocused(status === 'active');
    });
}

function KeyboardWrapper({ children }: PropsWithChildren) {
    if (useSafeNativeShims || isWeb) {
        return <>{children}</>;
    }

    try {
        const { KeyboardProvider } = require('react-native-keyboard-controller');
        return <KeyboardProvider>{children}</KeyboardProvider>;
    } catch (error) {
        console.warn('[startup] KeyboardProvider unavailable:', error);
        return <>{children}</>;
    }
}

function useNotificationObserver() {
    useEffect(() => {
        if (Platform.OS === 'web' || isExpoGo) return;

        let Notifications: typeof import('expo-notifications');
        try {
            Notifications = require('expo-notifications');
        } catch {
            return;
        }

        function redirect(notification: import('expo-notifications').Notification) {
            const url = notification.request.content.data?.url;
            if (typeof url === 'string') {
                router.push(url);
            }
        }

        try {
            const response = Notifications.getLastNotificationResponse();
            if (response?.notification) {
                redirect(response.notification);
            }

            const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
                redirect(response.notification);
            });

            return () => {
                subscription.remove();
            };
        } catch (error) {
            console.warn('[startup] Notification observer setup failed:', error);
        }
    }, []);
}

function ThemedStatusBar() {
    const { isDark } = useTheme();

    return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

/** Expo Go: no Stack.Protected — sign-in or tabs only. */
function ExpoGoAppContent() {
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const hasHydrated = useAuthStore((s) => s._hasHydrated);
    const [showBanner, setShowBanner] = useState(true);

    useLayoutEffect(() => {
        console.warn('[startup] Expo Go — rehydrate prefs then restore session');
        void useAuthStore.persist.rehydrate().finally(() => {
            useAuthStore.getState().setHasHydrated(true);
        });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setShowBanner(false), EXPO_GO_BANNER_MS);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!hasHydrated) return;
        hideSplash();
        router.replace(isLoggedIn ? '/(tabs)' : '/sign-in');
    }, [isLoggedIn, hasHydrated]);

    return (
        <>
            <ExpoGoStartupBanner visible={showBanner} />
            <ThemedStatusBar />
            <Stack
                screenOptions={{ headerShown: false }}
                initialRouteName={isLoggedIn ? '(tabs)' : 'sign-in'}>
                <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="private" />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                <Stack.Screen name="create-account" />
            </Stack>
        </>
    );
}

function NativeAppContent() {
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const hasHydrated = useAuthStore((s) => s._hasHydrated);
    const shouldCreateAccount = useAuthStore((s) => s.shouldCreateAccount);

    useNotificationObserver();

    if (!hasHydrated) {
        return null;
    }

    return (
        <>
            <ThemedStatusBar />
            <Stack>
                <Stack.Protected guard={isLoggedIn}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="private" options={{ headerShown: false }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                </Stack.Protected>

                <Stack.Protected guard={!isLoggedIn}>
                    <Stack.Screen
                        name="sign-in"
                        options={{ headerShown: false, gestureEnabled: false }}
                    />
                    <Stack.Protected guard={shouldCreateAccount}>
                        <Stack.Screen name="create-account" />
                    </Stack.Protected>
                </Stack.Protected>
            </Stack>
        </>
    );
}

function hideSplash() {
    void SplashScreen.hideAsync().catch(() => {});
}

function useGlobalStartupErrorHandler() {
    useEffect(() => {
        if (!isExpoGo) return;

        const errorUtils = (global as { ErrorUtils?: { setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void; getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void } }).ErrorUtils;
        const previousHandler = errorUtils?.getGlobalHandler?.();

        errorUtils?.setGlobalHandler?.((error, isFatal) => {
            console.error('[startup] Uncaught JS error (Expo Go):', error, { isFatal });
            previousHandler?.(error, isFatal);
        });
    }, []);
}

function useAndroidSystemBars() {
    useEffect(() => {
        if (Platform.OS !== 'android') {
            return;
        }

        void import('expo-system-ui').then((SystemUI) => {
            void SystemUI.setBackgroundColorAsync('#000000');
        });
    }, []);
}

export default function RootLayout() {
    const hasHydrated = useAuthStore((s) => s._hasHydrated);

    useGlobalStartupErrorHandler();
    useAndroidSystemBars();

    useLayoutEffect(() => {
        if (hasHydrated) {
            hideSplash();
        }
    }, [hasHydrated]);

    useEffect(() => {
        const splashFailsafe = setTimeout(() => {
            console.warn('[startup] Splash fail-safe fired');
            hideSplash();
            if (!useAuthStore.getState()._hasHydrated) {
                useAuthStore.getState().setHasHydrated(true);
            }
        }, SPLASH_FAILSAFE_MS);

        if (isExpoGo) {
            return () => clearTimeout(splashFailsafe);
        }

        console.warn('[startup] RootLayout mount — starting auth rehydrate');

        void useAuthStore.persist.rehydrate().catch((error) => {
            console.warn('[startup] persist.rehydrate failed:', error);
            useAuthStore.getState().setHasHydrated(true);
        });

        return () => clearTimeout(splashFailsafe);
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StartupErrorBoundary label="Flip">
                    <ThemeProvider>
                        <QueryClientProvider client={queryClient}>
                            <KeyboardWrapper>
                                {isExpoGo ? <ExpoGoAppContent /> : <NativeAppContent />}
                            </KeyboardWrapper>
                        </QueryClientProvider>
                    </ThemeProvider>
                </StartupErrorBoundary>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
