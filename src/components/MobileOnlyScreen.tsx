import { Stack } from 'expo-router';
import { StyleSheet, Text, View, Platform } from 'react-native';

/** Placeholder when camera native module is unavailable (web or wrong app). */
export default function MobileOnlyScreen({ title }: { title: string }) {
    const isWeb = Platform.OS === 'web';

    return (
        <>
            <Stack.Screen options={{ title }} />
            <View style={styles.container}>
                <Text style={styles.title}>{title}</Text>
                {isWeb ? (
                    <Text style={styles.body}>
                        Camera recording is only available in the Flip mobile app. Open this project
                        on your phone using the Flip dev build.
                    </Text>
                ) : (
                    <Text style={styles.body}>
                        Camera requires the Flip dev build with native CameraX. On your PC run{' '}
                        <Text style={styles.mono}>npm.cmd start</Text>, then{' '}
                        <Text style={styles.mono}>adb reverse tcp:8081 tcp:8081</Text>, and open the{' '}
                        <Text style={styles.emphasis}>Flip</Text> app from your home screen (package{' '}
                        <Text style={styles.mono}>social.flip.app</Text>). If you just added native
                        modules, rebuild once:{' '}
                        <Text style={styles.mono}>npm run android:build</Text>. See
                        docs/DEV_BUILD_ANDROID.md.
                    </Text>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#000',
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    body: {
        color: '#aaa',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        maxWidth: 360,
    },
    mono: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: '#ccc',
    },
    emphasis: {
        color: '#fff',
        fontWeight: '700',
    },
});
