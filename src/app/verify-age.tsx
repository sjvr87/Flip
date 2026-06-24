import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { useTheme } from '@/contexts/ThemeContext';
import {
    AGE_VERIFY_BYPASS,
    AGE_VERIFY_ENABLED,
    getPostAuthRoute,
} from '@/utils/ageVerification';
import { useAuthStore } from '@/utils/authStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function VerifyAgeScreen() {
    const { isDark } = useTheme();
    const logOut = useAuthStore((s) => s.logOut);
    const setAgeVerified = useAuthStore((s) => s.setAgeVerified);
    const ageVerified = useAuthStore((s) => s.ageVerified);

    const bg = isDark ? '#000' : '#fff';
    const text = isDark ? '#fff' : '#111';
    const muted = isDark ? '#888' : '#666';

    const handleDevBypass = () => {
        if (!AGE_VERIFY_BYPASS) return;
        setAgeVerified(true);
        router.replace(getPostAuthRoute(true));
    };

    const handleSignOut = () => {
        logOut();
        router.replace('/sign-in');
    };

    if (!AGE_VERIFY_ENABLED) {
        router.replace('/(tabs)');
        return null;
    }

    if (ageVerified && !AGE_VERIFY_BYPASS) {
        router.replace('/(tabs)');
        return null;
    }

    return (
        <View style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={styles.content}>
                <View style={[styles.iconWrap, { backgroundColor: `${LOOP_ACCENT}22` }]}>
                    <Ionicons name="id-card-outline" size={40} color={LOOP_ACCENT} />
                </View>
                <Text style={[styles.title, { color: text }]}>Age verification required</Text>
                <Text style={[styles.body, { color: muted }]}>
                    Flip is available to users who are 21 or older. After signing in with Bluesky,
                    you will verify your age with a secure ID check. We do not store your ID on Flip
                    — only whether verification passed.
                </Text>
                <Pressable
                    style={[styles.primaryBtn, { backgroundColor: LOOP_ACCENT, opacity: 0.5 }]}
                    disabled>
                    <Text style={styles.primaryBtnText}>Verify age (coming soon)</Text>
                </Pressable>
                <Text style={[styles.hint, { color: muted }]}>
                    Vendor integration and backend session API are not wired yet. See
                    docs/AGE_VERIFICATION.md.
                </Text>
                {AGE_VERIFY_BYPASS ? (
                    <Pressable onPress={handleDevBypass} style={styles.devBypass}>
                        <Text style={{ color: LOOP_ACCENT, fontSize: 14 }}>Dev: skip verification</Text>
                    </Pressable>
                ) : null}
                <Pressable onPress={handleSignOut} style={styles.signOut}>
                    <Text style={{ color: muted, fontSize: 15 }}>Sign out</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    content: {
        alignItems: 'center',
        maxWidth: 400,
        alignSelf: 'center',
        width: '100%',
    },
    iconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    body: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 28,
    },
    primaryBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    hint: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    devBypass: {
        paddingVertical: 12,
        marginBottom: 8,
    },
    signOut: {
        paddingVertical: 12,
    },
});
