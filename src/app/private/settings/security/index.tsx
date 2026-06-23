import {
    Divider,
    SectionHeader,
    SettingsItem,
    SettingsStatusItem,
    SettingsToggleItemDescription,
} from '@/components/settings/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { canUseBiometrics, getBiometricLabel } from '@/utils/biometricAuth';
import { useAuthStore } from '@/utils/authStore';
import { fetchAccountSecurityConfig, openLocalLink } from '@/utils/requests';
import { useQuery } from '@tanstack/react-query';
import * as MediaLibrary from 'expo-media-library';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform, ScrollView, View } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import tw from 'twrnc';

export default function SecurityScreen() {
    const router = useRouter();
    const [twoFactor, setTwoFactor] = useState(false);
    const { isDark } = useTheme();
    const rememberLogin = useAuthStore((s) => s.rememberLogin);
    const requireBiometric = useAuthStore((s) => s.requireBiometric);
    const setRememberLogin = useAuthStore((s) => s.setRememberLogin);
    const setRequireBiometric = useAuthStore((s) => s.setRequireBiometric);
    const [biometricLabel, setBiometricLabel] = useState('Fingerprint');
    const [biometricsAvailable, setBiometricsAvailable] = useState(false);

    const [cameraPermission, setCameraPermission] = useState(null);
    const [microphonePermission, setMicrophonePermission] = useState(null);
    const [photosPermission, setPhotosPermission] = useState(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['securitySettings'],
        queryFn: fetchAccountSecurityConfig,
    });

    useEffect(() => {
        if (data?.data?.two_factor_enabled !== undefined) {
            setTwoFactor(data.data.two_factor_enabled);
        }
    }, [data]);

    useEffect(() => {
        void (async () => {
            const available = await canUseBiometrics();
            setBiometricsAvailable(available);
            if (available) {
                setBiometricLabel(await getBiometricLabel());
            }
        })();
    }, []);

    const handleRememberLoginChange = async (value: boolean) => {
        await setRememberLogin(value);
        if (!value && requireBiometric) {
            setRequireBiometric(false);
        }
    };

    const handleTwoFactorSetup = async () => {
        await openLocalLink('/dashboard/account/security');
    };

    const checkPermissions = async () => {
        if (Platform.OS === 'android') {
            const cameraGranted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.CAMERA,
            );
            const micGranted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            );
            setCameraPermission(cameraGranted ? 'granted' : 'denied');
            setMicrophonePermission(micGranted ? 'granted' : 'denied');
        } else {
            const cameraStatus = await Camera.getCameraPermissionStatus();
            const microphoneStatus = await Camera.getMicrophonePermissionStatus();
            setCameraPermission(cameraStatus);
            setMicrophonePermission(microphoneStatus);
        }
        const mediaLibrary = await MediaLibrary.getPermissionsAsync();
        setPhotosPermission(mediaLibrary.status);
    };

    useFocusEffect(
        useCallback(() => {
            checkPermissions();
        }, []),
    );

    const openAppSettings = () => {
        Alert.alert(
            'Permission Required',
            'This permission has been denied. Please enable it in your device settings.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open Settings',
                    onPress: () => Linking.openSettings(),
                },
            ],
        );
    };

    const handleCameraPermission = async () => {
        if (cameraPermission === 'granted') {
            openAppSettings();
            return;
        }

        if (Platform.OS === 'android') {
            const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            setCameraPermission(
                status === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied',
            );
            if (status !== PermissionsAndroid.RESULTS.GRANTED) openAppSettings();
            return;
        }

        if (cameraPermission === 'denied' || cameraPermission === 'restricted') {
            openAppSettings();
            return;
        }

        const status = await Camera.requestCameraPermission();
        setCameraPermission(status);

        if (status === 'denied') {
            openAppSettings();
        }
    };

    const handleMicrophonePermission = async () => {
        if (microphonePermission === 'granted') {
            openAppSettings();
            return;
        }

        if (Platform.OS === 'android') {
            const status = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            );
            setMicrophonePermission(
                status === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied',
            );
            if (status !== PermissionsAndroid.RESULTS.GRANTED) openAppSettings();
            return;
        }

        if (microphonePermission === 'denied' || microphonePermission === 'restricted') {
            openAppSettings();
            return;
        }

        const status = await Camera.requestMicrophonePermission();
        setMicrophonePermission(status);

        if (status === 'denied') {
            openAppSettings();
        }
    };

    const handlePhotosPermission = async () => {
        if (photosPermission === 'granted') {
            openAppSettings();
            return;
        }

        if (photosPermission === 'denied') {
            openAppSettings();
            return;
        }

        const { status } = await MediaLibrary.requestPermissionsAsync();
        setPhotosPermission(status);

        if (status === 'denied') {
            openAppSettings();
        }
    };

    const getPermissionLabel = (status) => {
        if (!status) return 'Checking...';

        switch (status) {
            case 'granted':
                return null;
            case 'denied':
            case 'restricted':
                return 'Denied';
            case 'not-determined':
                return 'Allow';
            default:
                return 'Unknown';
        }
    };

    return (
        <View style={tw`flex-1 bg-gray-100 dark:bg-black`}>
            <Stack.Screen
                options={{
                    title: 'Security & permissions',
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                    headerBackTitle: 'Settings',
                    headerShown: true,
                }}
            />

            <ScrollView style={tw`flex-1`}>
                <SectionHeader title="Sign in" />
                <SettingsToggleItemDescription
                    icon="save-outline"
                    label="Remember login"
                    description="Stay signed in on this device. Session tokens are stored securely."
                    value={rememberLogin}
                    onValueChange={(value) => void handleRememberLoginChange(value)}
                />
                {biometricsAvailable ? (
                    <>
                        <Divider />
                        <SettingsToggleItemDescription
                            icon="finger-print-outline"
                            label={`Require ${biometricLabel}`}
                            description={
                                rememberLogin
                                    ? `Ask for ${biometricLabel.toLowerCase()} when reopening Flip after your session expires.`
                                    : 'Enable Remember login to use biometric unlock.'
                            }
                            value={requireBiometric && rememberLogin}
                            onValueChange={(value) => {
                                if (value && !rememberLogin) {
                                    void setRememberLogin(true);
                                }
                                setRequireBiometric(value);
                            }}
                        />
                    </>
                ) : null}

                <SectionHeader title="Security" />
                <SettingsItem
                    icon="key-outline"
                    label="Change password"
                    onPress={() => router.push('/private/settings/security/password')}
                />
                <Divider />
                <SettingsStatusItem
                    icon="shield-outline"
                    label="Two-factor authentication"
                    isActive={twoFactor}
                    onPress={handleTwoFactorSetup}
                />

                <SectionHeader title="App Permissions" />
                <SettingsStatusItem
                    icon="camera-outline"
                    label="Camera"
                    isActive={cameraPermission === 'granted'}
                    inactiveText={getPermissionLabel(cameraPermission)}
                    onPress={handleCameraPermission}
                    activeIconColor="#22D3EE"
                />
                <Divider />
                <SettingsStatusItem
                    icon="mic-outline"
                    label="Microphone"
                    isActive={microphonePermission === 'granted'}
                    inactiveText={getPermissionLabel(microphonePermission)}
                    onPress={handleMicrophonePermission}
                    activeIconColor="#22D3EE"
                />
                <Divider />
                <SettingsStatusItem
                    icon="images-outline"
                    label="Media Library"
                    isActive={photosPermission === 'granted'}
                    inactiveText={getPermissionLabel(photosPermission)}
                    onPress={handlePhotosPermission}
                    activeIconColor="#22D3EE"
                />
            </ScrollView>
        </View>
    );
}
