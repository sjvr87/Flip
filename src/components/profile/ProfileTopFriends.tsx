import Avatar from '@/components/Avatar';
import { StackText, YStack } from '@/components/ui/Stack';
import { fetchAccount } from '@/atproto';
import { Link } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { Pressable, ScrollView, View } from 'react-native';
import tw from 'twrnc';

type ProfileTopFriendsProps = {
    topFriendIds?: string[];
    isOwner?: boolean;
};

export default function ProfileTopFriends({ topFriendIds, isOwner }: ProfileTopFriendsProps) {
    const ids = (topFriendIds ?? []).slice(0, 8);

    const profileQueries = useQueries({
        queries: ids.map((did) => ({
            queryKey: ['fetchAccount', did],
            queryFn: async () => (await fetchAccount(did)).data,
            staleTime: 5 * 60 * 1000,
        })),
    });

    if (ids.length === 0) {
        if (!isOwner) return null;
        return (
            <Link href="/private/settings/account/edit-top-friends" asChild>
                <Pressable style={tw`mx-5 mb-2 py-3 rounded-xl bg-gray-100 dark:bg-gray-900 items-center`}>
                    <StackText fontSize="$3" textColor="text-gray-600 dark:text-gray-300">
                        Add your Top 8
                    </StackText>
                </Pressable>
            </Link>
        );
    }

    return (
        <YStack paddingX="$5" paddingBottom="$2" gap="$2">
            <StackText
                fontSize="$2"
                fontWeight="bold"
                textColor="text-gray-500 dark:text-gray-400"
                style={tw`uppercase tracking-wide`}>
                Top 8
            </StackText>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={tw`gap-3 pb-1`}>
                {ids.map((did, index) => {
                    const profile = profileQueries[index]?.data;
                    return (
                        <Link key={did} href={`/private/profile/${did}`} asChild>
                            <Pressable style={tw`items-center w-16`}>
                                <Avatar url={profile?.avatar} width={56} />
                                <StackText
                                    fontSize="$1"
                                    numberOfLines={1}
                                    textColor="text-gray-700 dark:text-gray-300"
                                    style={tw`mt-1 text-center w-full`}>
                                    {profile?.username ? `@${profile.username}` : '…'}
                                </StackText>
                            </Pressable>
                        </Link>
                    );
                })}
                {isOwner ? (
                    <Link href="/private/settings/account/edit-top-friends" asChild>
                        <Pressable
                            style={tw`w-14 h-14 rounded-full border border-dashed border-gray-300 dark:border-gray-600 items-center justify-center`}>
                            <StackText fontSize="$4" textColor="text-gray-400">
                                +
                            </StackText>
                        </Pressable>
                    </Link>
                ) : null}
            </ScrollView>
        </YStack>
    );
}
