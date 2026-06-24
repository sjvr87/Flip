import { completeOAuthRedirect, getCurrentServer } from '@/atproto/auth';
import {
    hasOAuthCallbackParams,
    resolveOAuthCallbackSearchParams,
} from '@/atproto/oauthCallbackUrl';
import {
    getOAuthSignInOutcome,
    isOAuthSignInInFlight,
    resetOAuthClient,
    waitForOAuthSignIn,
    wasOAuthCustomTabExchangeAttempted,
} from '@/atproto/oauthClient';
import { clearCredentials } from '@/atproto/credentialVault';
import { resetAuthFailureFlag } from '@/utils/requests';
import { getPostAuthRoute } from '@/utils/ageVerification';
import { useAuthStore } from '@/utils/authStore';
import { router, useLocalSearchParams } from 'expo-router';
import { useURL } from 'expo-linking';
import { useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

const OAUTH_LOGGED_IN_WAIT_MS = 3_000;
const OAUTH_CUSTOM_TAB_LOGIN_WAIT_MS = 60_000;
const OAUTH_POLL_MS = 200;

async function waitForLoggedIn(maxMs = OAUTH_LOGGED_IN_WAIT_MS): Promise<boolean> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
        if (useAuthStore.getState().isLoggedIn) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, OAUTH_POLL_MS));
    }
    return useAuthStore.getState().isLoggedIn;
}

export default function OAuthCallbackScreen() {
    const params = useLocalSearchParams();
    const linkingUrl = useURL();
    const handled = useRef(false);
    const [showProgress, setShowProgress] = useState(false);

    useLayoutEffect(() => {
        if (handled.current) return;
        handled.current = true;
        void handleCallback();
    }, []);

    const handleCallback = async () => {
        if (params?.error) {
            const errorMessage =
                (params.error_description as string) ||
                (params.error as string) ||
                'Authentication failed';
            Alert.alert('Sign In Error', errorMessage);
            router.replace('/sign-in');
            return;
        }

        if (isOAuthSignInInFlight()) {
            await waitForOAuthSignIn();
        }

        if (await waitForLoggedIn()) {
            router.replace(getPostAuthRoute(useAuthStore.getState().ageVerified));
            return;
        }

        // Custom Tab already exchanged (or failed on) this callback — ignore duplicate deep link.
        if (wasOAuthCustomTabExchangeAttempted()) {
            if (getOAuthSignInOutcome() === 'success') {
                if (await waitForLoggedIn(OAUTH_CUSTOM_TAB_LOGIN_WAIT_MS)) {
                    router.replace(getPostAuthRoute(useAuthStore.getState().ageVerified));
                    return;
                }
            }
            if (__DEV__) {
                console.warn(
                    '[auth] Ignoring duplicate OAuth callback deep link after Custom Tab exchange',
                );
            }
            router.replace('/sign-in');
            return;
        }

        const routeParams = params as Record<string, string | string[] | undefined>;
        const { searchParams } = await resolveOAuthCallbackSearchParams(routeParams, linkingUrl);

        if (!hasOAuthCallbackParams(searchParams)) {
            if (__DEV__) {
                console.warn(
                    '[auth] Stale OAuth callback deep link (no code/state); redirecting to sign-in',
                );
            }
            await resetOAuthClient();
            router.replace('/sign-in');
            return;
        }

        setShowProgress(true);

        try {
            const user = await completeOAuthRedirect(routeParams, linkingUrl);
            await clearCredentials();
            useAuthStore.setState({
                requireBiometric: false,
                isLoggedIn: true,
                user,
                server: getCurrentServer(),
                authReady: true,
            });
            resetAuthFailureFlag();
            router.replace(getPostAuthRoute(useAuthStore.getState().ageVerified));
        } catch (error) {
            if (__DEV__) {
                console.warn('[auth] OAuth callback route failed:', error);
            }
            const message =
                error instanceof Error ? error.message : 'Bluesky sign-in failed. Try again.';
            const isStale =
                isStaleOAuthCallbackError(error) ||
                message.includes('Duplicate OAuth callback after Custom Tab exchange');
            if (!message.toLowerCase().includes('cancel') && !isStale) {
                Alert.alert('Sign in failed', message);
            }
            if (!isStale) {
                await resetOAuthClient();
            }
            router.replace('/sign-in');
        }
    };

    return (
        <View style={styles.container}>
            {showProgress ? (
                <>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.text}>Completing sign in...</Text>
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    text: {
        marginTop: 16,
        fontSize: 16,
        color: '#999',
    },
});
