import { useAuthStore } from '@/utils/authStore';
import { Redirect, useRootNavigationState } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

/**
 * Auth gate for `/`. Wait for NavigationContainer linking to settle before Redirect.
 */
export default function Index() {
    const navigationState = useRootNavigationState();
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const hasHydrated = useAuthStore((s) => s._hasHydrated);
    const authReady = useAuthStore((s) => s.authReady);
    const [canRoute, setCanRoute] = useState(false);

    useEffect(() => {
        if (!navigationState?.key || !hasHydrated || !authReady) {
            setCanRoute(false);
            return;
        }
        const timer = setTimeout(() => setCanRoute(true), 100);
        return () => {
            clearTimeout(timer);
            setCanRoute(false);
        };
    }, [navigationState?.key, hasHydrated, authReady]);

    if (!canRoute) {
        return <View style={{ flex: 1, backgroundColor: '#000' }} />;
    }

    return <Redirect href={isLoggedIn ? '/(tabs)' : '/sign-in'} />;
}
