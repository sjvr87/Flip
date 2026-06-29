import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText, XStack, YStack } from '@/components/ui/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchProfilePrefs, fetchSelfAccount, saveProfilePrefs } from '@/atproto';
import { getAgent, withAuthenticatedFetch } from '@/atproto/agent';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import tw from 'twrnc';

const MAX_TOP_FRIENDS = 8;

export default function EditTopFriendsScreen() {
    const { isDark } = useTheme();
    const queryClient = useQueryClient();

    const { data: user } = useQuery({
        queryKey: ['fetchSelfAccount', 'self'],
        queryFn: async () => (await fetchSelfAccount()).data,
    });

    const { data: prefs, isLoading: prefsLoading } = useQuery({
        queryKey: ['profilePrefs', user?.id],
        queryFn: () => fetchProfilePrefs(user!.id),
        enabled: !!user?.id,
    });

    const { data: followingPage, isLoading: followingLoading } = useQuery({
        queryKey: ['accountFollowing', user?.id, 'top8-picker'],
        queryFn: async () => {
            const res = await withAuthenticatedFetch(() =>
                getAgent().app.bsky.graph.getFollows({ actor: user!.id, limit: 100 }),
            );
            return res.data.follows.map((follow) => ({
                id: follow.did,
                username: follow.handle ?? follow.did,
            }));
        },
        enabled: !!user?.id,
    });

    const topFriends = prefs?.topFriends ?? [];

    const saveMutation = useMutation({
        mutationFn: (next: string[]) => saveProfilePrefs({ topFriends: next }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profilePrefs', user?.id] });
        },
        onError: (error: Error) => {
            Alert.alert('Could not save', error.message || 'Try again later.');
        },
    });

    const toggleFriend = (did: string) => {
        const has = topFriends.includes(did);
        let next: string[];
        if (has) {
            next = topFriends.filter((id) => id !== did);
        } else {
            if (topFriends.length >= MAX_TOP_FRIENDS) {
                Alert.alert('Top 8 full', 'Remove someone before adding another friend.');
                return;
            }
            next = [...topFriends, did];
        }
        saveMutation.mutate(next);
    };

    const isLoading = prefsLoading || followingLoading;

    return (
        <View style={tw`flex-1 bg-white dark:bg-black`}>
            <Stack.Screen
                options={{
                    title: 'Top 8 friends',
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                    headerBackTitle: 'Account',
                }}
            />

            {isLoading ? (
                <View style={tw`flex-1 items-center justify-center`}>
                    <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
                </View>
            ) : (
                <ScrollView>
                    <View style={tw`px-5 pt-5 pb-3`}>
                        <Text style={tw`text-sm text-gray-500 dark:text-gray-400`}>
                            Pick up to eight people to feature on your profile — MySpace style.
                            Order is saved as you add them.
                        </Text>
                        <Text
                            style={tw`mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200`}>
                            {topFriends.length}/{MAX_TOP_FRIENDS} selected
                        </Text>
                    </View>

                    {topFriends.length > 0 ? (
                        <YStack paddingX="$5" paddingBottom="$3" gap="$2">
                            <StackText
                                fontSize="$2"
                                fontWeight="bold"
                                textColor="text-gray-500 dark:text-gray-400">
                                FEATURED
                            </StackText>
                            {topFriends.map((did, index) => {
                                const row = followingPage?.find((f) => f.id === did);
                                return (
                                    <XStack
                                        key={did}
                                        alignItems="center"
                                        justifyContent="space-between"
                                        style={tw`py-2 border-b border-gray-100 dark:border-gray-800`}>
                                        <XStack alignItems="center" gap="$3" flex={1}>
                                            <Text style={tw`text-gray-400 w-5`}>{index + 1}</Text>
                                            <StackText fontSize="$4" numberOfLines={1}>
                                                @{row?.username ?? did.slice(0, 12)}
                                            </StackText>
                                        </XStack>
                                        <PressableHaptics
                                            onPress={() => toggleFriend(did)}
                                            accessibilityLabel="Remove from Top 8">
                                            <Ionicons
                                                name="close-circle"
                                                size={22}
                                                color={isDark ? '#9ca3af' : '#6b7280'}
                                            />
                                        </PressableHaptics>
                                    </XStack>
                                );
                            })}
                        </YStack>
                    ) : null}

                    <YStack paddingX="$5" paddingTop="$2" gap="$2">
                        <StackText
                            fontSize="$2"
                            fontWeight="bold"
                            textColor="text-gray-500 dark:text-gray-400">
                            PEOPLE YOU FOLLOW
                        </StackText>
                        {(followingPage ?? []).map((person) => {
                            const selected = topFriends.includes(person.id);
                            return (
                                <PressableHaptics
                                    key={person.id}
                                    onPress={() => toggleFriend(person.id)}
                                    style={tw`flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800`}>
                                    <StackText fontSize="$4" numberOfLines={1} style={tw`flex-1`}>
                                        @{person.username}
                                    </StackText>
                                    <Ionicons
                                        name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                                        size={24}
                                        color={
                                            selected ? '#22d3ee' : isDark ? '#9ca3af' : '#6b7280'
                                        }
                                    />
                                </PressableHaptics>
                            );
                        })}
                        {(followingPage ?? []).length === 0 ? (
                            <Text style={tw`text-sm text-gray-500 py-4`}>
                                Follow people first, then pick your Top 8 here.
                            </Text>
                        ) : null}
                    </YStack>

                    {saveMutation.isPending ? (
                        <View style={tw`py-4 items-center`}>
                            <ActivityIndicator size="small" />
                        </View>
                    ) : null}
                </ScrollView>
            )}
        </View>
    );
}
