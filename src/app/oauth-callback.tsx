import { completeOAuthRedirect, getCurrentServer } from '@/atproto/auth';
import { isOAuthSignInInFlight, waitForOAuthSignIn } from '@/atproto/oauthClient';
import { clearCredentials } from '@/atproto/credentialVault';
import { resetAuthFailureFlag } from '@/utils/requests';
import { useAuthStore } from '@/utils/authStore';
import { router, useLocalSearchParams } from 'expo-router';
import { useURL } from 'expo-linking';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

const OAUTH_WAIT_MS = 60_000;
const OAUTH_POLL_MS = 200;

async function waitForLoggedIn(): Promise<boolean> {
    const deadline = Date.now() + OAUTH_WAIT_MS;
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

    useEffect(() => {
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
            router.replace('/(tabs)');
            return;
        }

        try {
            const user = await completeOAuthRedirect(
                params as Record<string, string | string[] | undefined>,
                linkingUrl,
            );
            await clearCredentials();
            useAuthStore.setState({
                requireBiometric: false,
                isLoggedIn: true,
                user,
                server: getCurrentServer(),
                authReady: true,
            });
            resetAuthFailureFlag();
            router.replace('/(tabs)');
        } catch (error) {
            if (__DEV__) {
                console.warn('[auth] OAuth callback route failed:', error);
            }
            const message =
                error instanceof Error ? error.message : 'Bluesky sign-in failed. Try again.';
            if (!message.toLowerCase().includes('cancel')) {
                Alert.alert('Sign in failed', message);
            }
            router.replace('/sign-in');
        }
    };

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.text}>Completing sign in...</Text>
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
