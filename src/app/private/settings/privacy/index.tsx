import { SectionHeader, SettingsItem, SettingsToggleItem } from '@/components/settings/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchProfilePrefs, saveProfilePrefs } from '@/atproto';
import { fetchAccountPrivacy, updateAccountPrivacy, usesAtprotoBackend } from '@/utils/requests';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import tw from 'twrnc';

export default function PrivacyScreen() {
    const [suggestAccount, setSuggestAccount] = useState(true);
    const [hideFollowersList, setHideFollowersList] = useState(false);
    const [hideFollowingList, setHideFollowingList] = useState(false);
    const queryClient = useQueryClient();
    const router = useRouter();
    const { isDark } = useTheme();
    const atproto = usesAtprotoBackend();

    const { data, isLoading, error } = useQuery({
        queryKey: ['privacySettings'],
        queryFn: fetchAccountPrivacy,
    });

    useEffect(() => {
        if (data?.data?.discoverable !== undefined) {
            setSuggestAccount(data.data.discoverable);
        }
    }, [data]);

    const { data: profilePrefs } = useQuery({
        queryKey: ['profilePrefs', 'self'],
        queryFn: async () => {
            const { fetchSelfAccount } = await import('@/utils/requests');
            const self = (await fetchSelfAccount()).data;
            if (!self?.id) return null;
            return fetchProfilePrefs(self.id);
        },
        enabled: atproto,
    });

    useEffect(() => {
        if (!profilePrefs) return;
        setHideFollowersList(profilePrefs.hideFollowersList === true);
        setHideFollowingList(profilePrefs.hideFollowingList === true);
    }, [profilePrefs]);

    const profilePrefsMutation = useMutation({
        mutationFn: saveProfilePrefs,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profilePrefs'] });
        },
    });

    const updatePrivacyMutation = useMutation({
        mutationFn: (params) => updateAccountPrivacy(params),
        onMutate: async (newSettings) => {
            await queryClient.cancelQueries({ queryKey: ['privacySettings'] });
            const previousSettings = queryClient.getQueryData(['privacySettings']);

            queryClient.setQueryData(['privacySettings'], (old) => ({
                ...old,
                ...newSettings,
            }));

            return { previousSettings };
        },
        onSuccess: (data) => {
            console.log('Response data:', data);
            queryClient.invalidateQueries({ queryKey: ['privacySettings'] });
        },
        onError: (error, newSettings, context) => {
            console.log('Mutation error:', error);
            if (context?.previousSettings) {
                queryClient.setQueryData(['privacySettings'], context.previousSettings);
                setSuggestAccount(context.previousSettings.discoverable);
            }
        },
    });

    const handleToggleSuggest = (value) => {
        setSuggestAccount(value);
        updatePrivacyMutation.mutate({ discoverable: value });
    };

    const handleToggleHideFollowers = (value: boolean) => {
        setHideFollowersList(value);
        profilePrefsMutation.mutate({ hideFollowersList: value });
    };

    const handleToggleHideFollowing = (value: boolean) => {
        setHideFollowingList(value);
        profilePrefsMutation.mutate({ hideFollowingList: value });
    };

    return (
        <View style={tw`flex-1 bg-gray-100 dark:bg-black`}>
            <Stack.Screen
                options={{
                    title: 'Privacy',
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                    headerBackTitle: 'Settings',
                    headerShown: true,
                }}
            />

            <ScrollView style={tw`flex-1`}>
                <SectionHeader title="Account Privacy" />
                {/* <SettingsToggleItem
                    icon="lock-closed-outline"
                    label="Private account"
                    value={privateAccount}
                    onValueChange={setPrivateAccount}
                    />
                    <Divider /> */}
                <SettingsToggleItem
                    icon="people-outline"
                    label="Suggest account to others"
                    value={suggestAccount}
                    onValueChange={handleToggleSuggest}
                />
                {atproto ? (
                    <>
                        <SectionHeader title="Profile lists" />
                        <SettingsToggleItem
                            icon="eye-off-outline"
                            label="Hide followers list"
                            value={hideFollowersList}
                            onValueChange={handleToggleHideFollowers}
                        />
                        <SettingsToggleItem
                            icon="eye-off-outline"
                            label="Hide following list"
                            value={hideFollowingList}
                            onValueChange={handleToggleHideFollowing}
                        />
                    </>
                ) : null}
                <SectionHeader title="Interactions" />
                <SettingsItem
                    icon="close-circle-outline"
                    label="Blocked Accounts"
                    onPress={() => router.push('/private/settings/privacy/blockedAccounts')}
                />
                {/* <SectionHeader title="Interactions" />
                <SettingsItem icon="chatbubble-outline" label="Comments" onPress={() => {}} />
                <Divider />
                <SettingsItem
                    icon="paper-plane-outline"
                    label="Direct messages"
                    onPress={() => {}}
                /> */}
                {/* <Divider />
                <SettingsItem icon="at-outline" label="Mentions and tags" onPress={() => {}} />

                <SectionHeader title="Data" />
                <SettingsItem
                    icon="download-outline"
                    label="Download your data"
                    onPress={() => {}}
                />
                <Divider />
                <SettingsItem icon="eye-off-outline" label="Watch history" onPress={() => {}} />
                <Divider />
                <SettingsItem icon="search-outline" label="Search history" onPress={() => {}} /> */}
            </ScrollView>
        </View>
    );
}
