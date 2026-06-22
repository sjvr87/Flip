import MentionText from '@/components/MentionText';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText } from '@/components/ui/Stack';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import {
    followAccount,
    getExploreAccounts,
    postExploreAccountHideSuggestion,
} from '@/utils/requests';
import { prettyCount } from '@/utils/ui';
import { toProfilePath } from '@/utils/profileNavigation';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import tw from 'twrnc';

type ExploreAccount = {
    id: string;
    name: string;
    avatar: string;
    username: string;
    bio: string;
    follower_count: number;
    post_count?: number;
};

interface AccountRowProps {
    account: ExploreAccount;
    onFollow: (id: string) => void;
    onHide: (id: string) => void;
    onView: (id: string) => void;
    isFollowing: boolean;
    isHiding: boolean;
}

function SuggestedAccountRow({
    account,
    onFollow,
    onHide,
    onView,
    isFollowing,
    isHiding,
}: AccountRowProps) {
    return (
        <View style={tw`px-4 py-3 border-b border-gray-100 dark:border-gray-900`}>
            <View style={tw`flex-row items-start`}>
                <PressableHaptics onPress={() => onView(account.id)}>
                    {account.avatar ? (
                        <Image source={{ uri: account.avatar }} style={tw`w-14 h-14 rounded-full mr-3`} />
                    ) : (
                        <View
                            style={tw`w-14 h-14 rounded-full mr-3 bg-gray-200 dark:bg-gray-800 items-center justify-center`}>
                            <Ionicons name="person" size={24} color="#999" />
                        </View>
                    )}
                </PressableHaptics>

                <View style={tw`flex-1`}>
                    <PressableHaptics onPress={() => onView(account.id)}>
                        <MentionText
                            username={account.username}
                            style={{ fontSize: 16, fontWeight: '600' }}
                            numberOfLines={1}
                        />
                        {account.name && account.name !== account.username ? (
                            <StackText
                                fontSize="$3"
                                textColor="text-gray-600 dark:text-gray-400"
                                numberOfLines={1}>
                                {account.name}
                            </StackText>
                        ) : null}
                        {account.bio ? (
                            <StackText
                                fontSize="$3"
                                textColor="text-gray-600 dark:text-gray-500"
                                numberOfLines={2}
                                style={tw`mt-1`}>
                                {account.bio}
                            </StackText>
                        ) : null}
                        <StackText
                            fontSize="$2"
                            textColor="text-gray-500 dark:text-gray-500"
                            style={tw`mt-1`}>
                            {prettyCount(account.follower_count)} followers
                            {account.post_count != null ? ` · ${prettyCount(account.post_count)} posts` : ''}
                        </StackText>
                    </PressableHaptics>

                    <View style={tw`flex-row items-center gap-2 mt-3`}>
                        <PressableHaptics
                            onPress={() => onFollow(account.id)}
                            disabled={isFollowing || isHiding}
                            style={({ pressed }) => [
                                tw`rounded-2xl px-6 py-2`,
                                { backgroundColor: LOOP_ACCENT },
                                (pressed || isFollowing) && tw`opacity-70`,
                            ]}>
                            {isFollowing ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <StackText fontSize="$3" textColor="text-white" fontWeight="semibold">
                                    Follow
                                </StackText>
                            )}
                        </PressableHaptics>
                        <PressableHaptics
                            onPress={() => onHide(account.id)}
                            disabled={isFollowing || isHiding}
                            style={({ pressed }) => [
                                tw`rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-700`,
                                pressed && tw`opacity-50`,
                            ]}>
                            {isHiding ? (
                                <ActivityIndicator size="small" color="#666" />
                            ) : (
                                <StackText
                                    fontSize="$3"
                                    textColor="text-gray-600 dark:text-gray-400"
                                    fontWeight="semibold">
                                    Remove
                                </StackText>
                            )}
                        </PressableHaptics>
                    </View>
                </View>
            </View>
        </View>
    );
}

export function SuggestedAccountsSection() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [followingAccountId, setFollowingAccountId] = useState<string | null>(null);
    const [hidingAccountId, setHidingAccountId] = useState<string | null>(null);

    const { data: accountsData } = useQuery({
        queryKey: ['accounts', 'suggested'],
        queryFn: getExploreAccounts,
        retry: 2,
    });

    const followMutation = useMutation({
        mutationFn: async (profileId: string) => {
            setFollowingAccountId(profileId);
            return await followAccount(profileId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts', 'suggested'] });
        },
        onSettled: () => setFollowingAccountId(null),
    });

    const hideSuggestionMutation = useMutation({
        mutationFn: async (profileId: string) => {
            setHidingAccountId(profileId);
            return await postExploreAccountHideSuggestion(profileId);
        },
        onMutate: async (profileId) => {
            await queryClient.cancelQueries({ queryKey: ['accounts', 'suggested'] });
            const previousAccounts = queryClient.getQueryData(['accounts', 'suggested']);
            queryClient.setQueryData(['accounts', 'suggested'], (old: ExploreAccount[] | undefined) =>
                old?.filter((account) => account.id !== profileId) || [],
            );
            return { previousAccounts };
        },
        onError: (_err, _profileId, context) => {
            if (context?.previousAccounts) {
                queryClient.setQueryData(['accounts', 'suggested'], context.previousAccounts);
            }
        },
        onSettled: () => {
            setHidingAccountId(null);
            queryClient.invalidateQueries({ queryKey: ['accounts', 'suggested'] });
        },
    });

    const accounts = accountsData || [];
    if (accounts.length === 0) return null;

    return (
        <View style={tw`mt-4 border-t border-gray-100 dark:border-gray-900`}>
            <View style={tw`px-4 py-4`}>
                <StackText
                    fontSize="$5"
                    fontWeight="semibold"
                    textColor="text-black dark:text-gray-300">
                    Suggested accounts
                </StackText>
                <StackText fontSize="$3" textColor="text-gray-500 dark:text-gray-500" style={tw`mt-1`}>
                    People you might want to follow
                </StackText>
            </View>
            {accounts.map((account: ExploreAccount) => (
                <SuggestedAccountRow
                    key={account.id}
                    account={account}
                    onFollow={(id) => followMutation.mutate(id)}
                    onView={(id) => router.push(toProfilePath(id))}
                    onHide={(id) => hideSuggestionMutation.mutate(id)}
                    isFollowing={followingAccountId === account.id}
                    isHiding={hidingAccountId === account.id}
                />
            ))}
        </View>
    );
}
