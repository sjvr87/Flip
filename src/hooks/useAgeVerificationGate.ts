import { isAgeVerificationRequired } from '@/utils/ageVerification';
import { useAuthStore } from '@/utils/authStore';
import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';

function isOAuthRoute(segments: string[]): boolean {
    const root = segments[0];
    return root === 'oauth-callback' || root === 'oauth';
}

/**
 * Redirect logged-in users who have not completed age verification.
 * OAuth routes are exempt so Bluesky sign-in is not interrupted.
 */
export function useAgeVerificationGate(): void {
    const hasHydrated = useAuthStore((s) => s._hasHydrated);
    const authReady = useAuthStore((s) => s.authReady);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const ageVerified = useAuthStore((s) => s.ageVerified);
    const segments = useSegments();

    useEffect(() => {
        if (!hasHydrated || !authReady || !isLoggedIn) return;
        if (!isAgeVerificationRequired(ageVerified)) return;

        const onVerifyAge = segments[0] === 'verify-age';
        if (onVerifyAge || isOAuthRoute(segments)) return;

        router.replace('/verify-age');
    }, [hasHydrated, authReady, isLoggedIn, ageVerified, segments]);
}
