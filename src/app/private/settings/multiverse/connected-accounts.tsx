import { Divider, SectionHeader } from '@/components/settings/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import {
    beginConnect,
    completeConnect,
    unlinkAccount,
} from '@/multiverse/api';
import { connectedAccountsQueryKey, useConnectedAccounts } from '@/multiverse/hooks/useConnectedAccounts';
import { ensureMultiverseSession } from '@/multiverse/session';
import { isMultiverseEnabled, isProviderEnabled, providerIconName } from '@/multiverse/config';
import { MultiverseProviderIds } from '@/multiverse/types';
import type { ConnectedAccount } from '@/multiverse/types';
import { useAuthStore } from '@/utils/authStore';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import tw from 'twrnc';

function AccountRow({
    account,
    onUnlink,
    busy,
}: {
    account: ConnectedAccount;
    onUnlink: (id: string) => void;
    busy: boolean;
}) {
    const { isDark } = useTheme();
    const statusColor =
        account.status === 'active' ? '#22c55e' : account.status === 'error' ? '#ef4444' : '#9ca3af';

    return (
        <View style={tw`flex-row items-center py-4 px-5 bg-white dark:bg-black`}>
            <Ionicons
                name={providerIconName(account.provider)}
                size={24}
                color={isDark ? '#fff' : '#6b7280'}
                style={tw`mr-4`}
            />
            <View style={tw`flex-1`}>
                <Text style={tw`text-base font-medium text-gray-900 dark:text-white`}>
                    @{account.handle.replace(/^@/, '')}
                </Text>
                <Text style={tw`text-sm text-gray-500 capitalize`}>
                    {account.provider} · {account.status}
                </Text>
            </View>
            <View style={[tw`w-2 h-2 rounded-full mr-3`, { backgroundColor: statusColor }]} />
            <TouchableOpacity
                onPress={() => onUnlink(account.id)}
                disabled={busy}
                accessibilityLabel={`Unlink ${account.handle}`}>
                <Text style={tw`text-sm text-red-500`}>Unlink</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function ConnectedAccountsScreen() {
    const { isDark } = useTheme();
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();
    const { data: accounts = [], isLoading, refetch } = useConnectedAccounts();

    const [linking, setLinking] = useState(false);
    const [handle, setHandle] = useState('');
    const [appPassword, setAppPassword] = useState('');
    const [connectState, setConnectState] = useState<string | null>(null);

    const unlinkMutation = useMutation({
        mutationFn: async (accountId: string) => {
            const token = await ensureMultiverseSession(user!.id, user?.username);
            await unlinkAccount(token, accountId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: connectedAccountsQueryKey });
        },
        onError: (err: Error) => {
            Alert.alert('Unlink failed', err.message);
        },
    });

    const startAtprotoLink = async () => {
        if (!user?.id) return;
        try {
            setLinking(true);
            const token = await ensureMultiverseSession(user.id, user.username);
            const flow = await beginConnect(token, MultiverseProviderIds.ATPROTO);
            setConnectState(flow.state);
            Alert.alert(
                'Link ATProto account',
                flow.instructions ??
                    'Enter your Bluesky handle and an app password on the next screen.',
            );
        } catch (err) {
            Alert.alert('Connect failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLinking(false);
        }
    };

    const completeAtprotoLink = async () => {
        if (!user?.id || !connectState) {
            Alert.alert('Start linking first', 'Tap "Link ATProto" before submitting credentials.');
            return;
        }
        try {
            setLinking(true);
            const token = await ensureMultiverseSession(user.id, user.username);
            await completeConnect(token, MultiverseProviderIds.ATPROTO, {
                state: connectState,
                handle: handle.trim(),
                appPassword,
            });
            setHandle('');
            setAppPassword('');
            setConnectState(null);
            await refetch();
            Alert.alert('Linked', 'ATProto account connected.');
        } catch (err) {
            Alert.alert('Link failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLinking(false);
        }
    };

    if (!isMultiverseEnabled()) {
        return (
            <View style={tw`flex-1 bg-gray-100 dark:bg-black p-5`}>
                <Text style={tw`text-gray-600 dark:text-gray-400`}>
                    Multiverse connected accounts are disabled in this build.
                </Text>
            </View>
        );
    }

    return (
        <View style={tw`flex-1 bg-gray-100 dark:bg-black`}>
            <Stack.Screen
                options={{
                    title: 'Connected accounts',
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                }}
            />
            <ScrollView style={tw`flex-1`}>
                <SectionHeader title="Linked destinations" />
                {isLoading ? (
                    <ActivityIndicator style={tw`my-6`} />
                ) : accounts.length === 0 ? (
                    <Text style={tw`px-5 py-4 text-gray-500`}>No external accounts linked yet.</Text>
                ) : (
                    accounts.map((account, i) => (
                        <View key={account.id}>
                            <AccountRow
                                account={account}
                                onUnlink={(id) => unlinkMutation.mutate(id)}
                                busy={unlinkMutation.isPending}
                            />
                            {i < accounts.length - 1 ? <Divider /> : null}
                        </View>
                    ))
                )}

                <SectionHeader title="Add account" />
                <View style={tw`px-5 py-4 bg-white dark:bg-black`}>
                    {isProviderEnabled('ATPROTO') ? (
                        <TouchableOpacity
                            onPress={startAtprotoLink}
                            disabled={linking}
                            style={tw`flex-row items-center py-3`}>
                            <Ionicons name="add-circle-outline" size={22} color="#22D3EE" />
                            <Text style={tw`ml-3 text-base text-[#22D3EE] font-medium`}>
                                Link ATProto (Bluesky)
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    {isProviderEnabled('NOSTR') ? (
                        <TouchableOpacity
                            disabled
                            style={tw`flex-row items-center py-3 opacity-50`}>
                            <Ionicons name="add-circle-outline" size={22} color="#22D3EE" />
                            <Text style={tw`ml-3 text-base text-gray-500 font-medium`}>
                                Link Nostr (beta)
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    <Text style={tw`text-xs text-gray-500 mt-2 mb-3`}>
                        Nostr and ActivityPub linking are scaffolded — enable feature flags when ready.
                    </Text>

                    {connectState ? (
                        <View style={tw`mt-2`}>
                            <TextInput
                                value={handle}
                                onChangeText={setHandle}
                                placeholder="handle.bsky.social"
                                placeholderTextColor="#9ca3af"
                                autoCapitalize="none"
                                style={tw`border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 mb-2 text-gray-900 dark:text-white`}
                            />
                            <TextInput
                                value={appPassword}
                                onChangeText={setAppPassword}
                                placeholder="App password"
                                placeholderTextColor="#9ca3af"
                                secureTextEntry
                                autoCapitalize="none"
                                style={tw`border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 mb-3 text-gray-900 dark:text-white`}
                            />
                            <TouchableOpacity
                                onPress={completeAtprotoLink}
                                disabled={linking}
                                style={tw`bg-[#22D3EE] rounded-full py-3 items-center ${linking ? 'opacity-60' : ''}`}>
                                <Text style={tw`text-black font-semibold`}>Save ATProto link</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </ScrollView>
        </View>
    );
}
