import { Divider, SectionHeader, SettingsItem } from '@/components/settings/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import tw from 'twrnc';

export default function SecurityScreen() {
    const router = useRouter();
    const { colorScheme } = useTheme();

    return (
        <>
            <Stack.Screen options={{ title: 'Security' }} />
            <ScrollView style={tw`flex-1 bg-white dark:bg-black`}>
                <View style={tw`px-4`}>
                    <SectionHeader title="Security" />
                    <SettingsItem
                        label="Password"
                        onPress={() => router.push('/private/settings/security/password')}
                    />
                    <Divider />
                    <SettingsItem
                        label="Blocked accounts"
                        onPress={() => router.push('/private/settings/privacy/blockedAccounts')}
                    />
                </View>
            </ScrollView>
        </>
    );
}
