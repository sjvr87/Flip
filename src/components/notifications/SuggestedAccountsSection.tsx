import MentionText from '@/components/MentionText';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText } from '@/components/ui/Stack';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import {
    fetchAuthorRecentMediaThumbnails,
    followAccount,
    getExploreAccounts,
    postExploreAccountHideSuggestion,
} from '@/utils/requests';
import { toProfilePath } from '@/utils/profileNavigation';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import tw from 'twrnc';

const PREVIEW_COUNT = 3;

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
    postThumbnails: string[];
    thumbsLoading: boolean;
    onFollow: (id: string) => void;
    onHide: (id: string) => void;
    onView: (id: string) => void;
    isFollowing: boolean;
    isHiding: boolean;
}

function PostPreviewThumb({
    thumbnailUrl,
    loading,
    isFirst,
}: {
    thumbnailUrl?: string | null;
    loading: boolean;
    isFirst?: boolean;
}) {
    return (
        <View
            style={[
                tw`flex-1 aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800`,
                !isFirst && tw`ml-1.5`,
            ]}>
            {thumbnailUrl ? (
                <Image source={{ uri: thumbnailUrl }} style={tw`w-full h-full`} resizeMode="cover" />
            ) : loading ? (
                <View style={tw`flex-1 items-center justify-center`}>
                    <ActivityIndicator size="small" color={LOOP_ACCENT} />
                </View>
            ) : (
                <View style={tw`flex-1 items-center justify-center`}>
                    <Ionicons name="image-outline" size={18} color="#555" />
                </View>
            )}
        </View>
    );
}

function SuggestedAccountRow({
    account,
    postThumbnails,
    thumbsLoading,
    onFollow,
    onHide,
    onView,
    isFollowing,
    isHiding,
}: AccountRowProps) {
    const previews = useMemo(() => {
        const slots: (string | null)[] = [];
        for (let i = 0; i < PREVIEW_COUNT; i++) {
            slots.push(postThumbnails[i] ?? null);
        }
        return slots;
    }, [postThumbnails]);

    return (
        <View
            style={tw`mx-4 mb-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-900`}>
            <PressableHaptics onPress={() => onView(account.id)} style={tw`flex-row items-center mb-3`}>
                {account.avatar ? (
                    <Image source={{ uri: account.avatar }} style={tw`w-11 h-11 rounded-full mr-3`} />
                ) : (
                    <View
                        style={tw`w-11 h-11 rounded-full mr-3 bg-gray-200 dark:bg-gray-800 items-center justify-center`}>
                        <Ionicons name="person" size={20} color="#999" />
                    </View>
                )}
                <View style={tw`flex-1`}>
                    {account.name && account.name !== account.username ? (
                        <StackText
                            fontSize="$4"
                            fontWeight="semibold"
                            textColor="text-black dark:text-white"
                            numberOfLines={1}>
                            {account.name}
                        </StackText>
                    ) : null}
                    <MentionText
                        username={account.username}
                        style={{
                            fontSize: 14,
                            fontWeight: account.name && account.name !== account.username ? '400' : '600',
                            color: account.name && account.name !== account.username ? '#9ca3af' : undefined,
                        }}
                        numberOfLines={1}
                    />
                </View>
            </PressableHaptics>

            <View style={tw`flex-row mb-3`}>
                {previews.map((thumbnail, index) => (
                    <PostPreviewThumb
                        key={index}
                        thumbnailUrl={thumbnail}
                        loading={thumbsLoading}
                        isFirst={index === 0}
                    />
                ))}
            </View>

            <View style={tw`flex-row items-center gap-2`}>
                <PressableHaptics
                    onPress={() => onFollow(account.id)}
                    disabled={isFollowing || isHiding}
                    style={({ pressed }) => [
                        tw`flex-1 rounded-xl py-2.5 items-center`,
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
                        tw`flex-1 rounded-xl py-2.5 items-center border border-gray-200 dark:border-gray-700`,
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

    const accounts = accountsData || [];
    const accountIds = useMemo(() => accounts.map((account: ExploreAccount) => account.id), [accounts]);

    const { data: postThumbnails, isLoading: thumbsLoading } = useQuery({
        queryKey: ['accounts', 'suggested', 'post-thumbs', accountIds, PREVIEW_COUNT],
        queryFn: () => fetchAuthorRecentMediaThumbnails(accountIds, PREVIEW_COUNT),
        enabled: accountIds.length > 0,
        staleTime: 10 * 60_000,
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

    if (accounts.length === 0) return null;

    return (
        <View style={tw`mt-4 pt-4 border-t border-gray-100 dark:border-gray-900`}>
            <View style={tw`px-4 pb-3`}>
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
                    postThumbnails={postThumbnails?.[account.id] ?? []}
                    thumbsLoading={thumbsLoading}
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
