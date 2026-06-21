import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText, YStack } from '@/components/ui/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/utils/authStore';
import { useNotificationStore } from '@/utils/notificationStore';
import { toProfilePath } from '@/utils/profileNavigation';
import {
    fetchConvos,
    fetchNotifications,
    followAccount,
    getExploreAccounts,
    postExploreAccountHideSuggestion,
} from '@/utils/requests';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    View,
} from 'react-native';
import tw from 'twrnc';

interface CategoryCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBgColor: string;
    title: string;
    subtitle: string;
    count: number;
    onPress: () => void;
}

const CategoryCard = ({
    icon,
    iconColor,
    iconBgColor,
    title,
    subtitle,
    count,
    onPress,
}: CategoryCardProps) => (
    <Pressable
        onPress={onPress}
        style={({ pressed }) => [
            tw`flex-row items-center px-4 py-4`,
            pressed && tw`bg-gray-50 dark:bg-gray-900`,
        ]}>
        <View
            style={[
                tw`w-14 h-14 rounded-full items-center justify-center mr-3`,
                { backgroundColor: iconBgColor },
            ]}>
            <Ionicons name={icon} size={28} color={iconColor} />
        </View>
        <View style={tw`flex-1`}>
            <StackText
                fontSize="$5"
                textColor="text-black dark:text-white"
                fontWeight={count ? 'semibold' : 'normal'}>
                {title}
            </StackText>
            <StackText
                fontSize="$3"
                textColor={
                    count ? 'text-black dark:text-gray-400' : 'text-gray-600 dark:text-gray-500'
                }
                fontWeight={count ? 'semibold' : 'normal'}
                numberOfLines={1}>
                {subtitle}
            </StackText>
        </View>
        {count > 0 ? (
            <View
                style={tw`bg-red-500 rounded-full ml-4 min-w-8 h-6 px-2 items-center justify-center`}>
                <StackText fontSize="$2" textColor="text-white" fontWeight="bold">
                    {count > 99 ? '99+' : count}
                </StackText>
            </View>
        ) : (
            <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
        )}
    </Pressable>
);

interface ConvoRowProps {
    convo: {
        id: string;
        members: Array<{ did: string; displayName: string; avatar: string; handle: string }>;
        lastMessage?: { text: string; sentAt: string };
        unreadCount: number;
    };
    myDid: string;
    onPress: () => void;
}

function ConvoRow({ convo, myDid, onPress }: ConvoRowProps) {
    const other = convo.members.find((m) => m.did !== myDid) ?? convo.members[0];
    const title = other?.displayName || other?.handle || 'Chat';
    const preview = convo.lastMessage?.text || 'No messages yet';

    return (
        <PressableHaptics onPress={onPress} style={tw`flex-row items-center px-4 py-3`}>
            {other?.avatar ? (
                <Image source={{ uri: other.avatar }} style={tw`w-12 h-12 rounded-full mr-3`} />
            ) : (
                <View
                    style={tw`w-12 h-12 rounded-full mr-3 bg-gray-200 dark:bg-gray-800 items-center justify-center`}>
                    <Ionicons name="person" size={22} color="#999" />
                </View>
            )}
            <View style={tw`flex-1`}>
                <StackText
                    fontSize="$4"
                    fontWeight={convo.unreadCount ? 'bold' : 'semibold'}
                    textColor="text-black dark:text-gray-200"
                    numberOfLines={1}>
                    {title}
                </StackText>
                <StackText
                    fontSize="$3"
                    textColor={
                        convo.unreadCount
                            ? 'text-black dark:text-gray-300'
                            : 'text-gray-600 dark:text-gray-500'
                    }
                    fontWeight={convo.unreadCount ? 'semibold' : 'normal'}
                    numberOfLines={1}>
                    {preview}
                </StackText>
            </View>
            {convo.unreadCount > 0 ? (
                <View
                    style={[
                        tw`rounded-full min-w-6 h-6 px-2 items-center justify-center`,
                        { backgroundColor: LOOP_ACCENT },
                    ]}>
                    <StackText fontSize="$2" textColor="text-white" fontWeight="bold">
                        {convo.unreadCount > 99 ? '99+' : convo.unreadCount}
                    </StackText>
                </View>
            ) : (
                <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
            )}
        </PressableHaptics>
    );
}

interface SuggestedAccountCardProps {
    account: any;
    onFollow: (id: string) => void;
    onHide: (id: string) => void;
    isFollowing: boolean;
    isHiding: boolean;
    onView: (id: string) => void;
}

const SuggestedAccountCard = ({
    account,
    onFollow,
    onHide,
    isFollowing,
    isHiding,
    onView,
}: SuggestedAccountCardProps) => (
    <View style={tw`flex-row items-center px-4 py-3`}>
        <PressableHaptics onPress={() => onView(account.id)}>
            <Image source={{ uri: account.avatar }} style={tw`w-12 h-12 rounded-full mr-3`} />
        </PressableHaptics>
        <View style={tw`flex-1`}>
            <PressableHaptics onPress={() => onView(account.id)}>
                <StackText
                    fontSize="$4"
                    fontWeight="semibold"
                    style={{ color: LOOP_ACCENT }}
                    numberOfLines={1}>
                    @{account.username}
                </StackText>
                {account.bio ? (
                    <StackText
                        fontSize="$3"
                        textColor="text-gray-600 dark:text-gray-500"
                        numberOfLines={1}>
                        {account.bio}
                    </StackText>
                ) : null}
            </PressableHaptics>
        </View>
        <View style={tw`flex-row items-center gap-2 ml-5`}>
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
                style={({ pressed }) => [tw`p-2`, pressed && tw`opacity-50`]}>
                {isHiding ? (
                    <ActivityIndicator size="small" color="#666" />
                ) : (
                    <Ionicons name="close-circle-outline" size={24} color="#999" />
                )}
            </PressableHaptics>
        </View>
    </View>
);

const getNotificationMessage = (notification: any): string => {
    const username = notification.actor?.username || notification.actor?.name || 'Someone';
    switch (notification.type) {
        case 'new_follower':
            return `${username} started following you.`;
        case 'video.like':
            return `${username} liked your video.`;
        case 'comment.like':
        case 'commentReply.like':
            return `${username} liked your comment.`;
        case 'video.comment':
            return `${username} commented on your video.`;
        case 'video.commentReply':
            return `${username} replied to your comment.`;
        case 'video.mention':
            return `${username} mentioned you.`;
        case 'video.share':
            return `${username} shared your video.`;
        case 'video.duet':
            return `${username} dueted your video.`;
        default:
            return `New notification from ${username}.`;
    }
};

type InboxScreenProps = {
    headerRight?: () => ReactNode;
};

export default function InboxScreen({ headerRight }: InboxScreenProps) {
    const router = useRouter();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const { markInboxViewed, refetchBadgeCount } = useNotificationStore();
    const [followingAccountId, setFollowingAccountId] = useState<string | null>(null);
    const [hidingAccountId, setHidingAccountId] = useState<string | null>(null);
    const { isDark } = useTheme();
    const myDid = user?.id ?? '';

    const {
        data,
        isLoading,
        isFetching,
        isError,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['main-notifications'],
        queryFn: fetchNotifications,
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
        staleTime: 0,
    });

    const {
        data: convosData,
        isLoading: convosLoading,
        refetch: refetchConvos,
    } = useQuery({
        queryKey: ['inbox-convos'],
        queryFn: () => fetchConvos(),
        refetchOnWindowFocus: true,
        staleTime: 30_000,
    });

    const { data: accountsData } = useQuery({
        queryKey: ['accounts', 'suggested'],
        queryFn: getExploreAccounts,
        retry: 2,
    });

    useFocusEffect(
        useCallback(() => {
            void markInboxViewed();
            void refetchBadgeCount();
        }, [markInboxViewed, refetchBadgeCount]),
    );

    const handleRefresh = useCallback(() => {
        void refetch();
        void refetchConvos();
        void refetchBadgeCount();
        queryClient.invalidateQueries({ queryKey: ['accounts', 'suggested'] });
    }, [queryClient, refetch, refetchConvos, refetchBadgeCount]);

    const followMutation = useMutation({
        mutationFn: async (profileId: string) => {
            setFollowingAccountId(profileId);
            return await followAccount(profileId);
        },
        onSuccess: async () => {
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
            queryClient.setQueryData(['accounts', 'suggested'], (old: any[] | undefined) =>
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

    const notifications = useMemo(() => {
        if (!data?.data?.length) return [];
        return data.data.flatMap((p: any) => p ?? []);
    }, [data]);

    const unreadCounts = data?.meta?.unread_counts || {
        activity: 0,
        followers: 0,
        system: 0,
        starterKits: 0,
    };

    const convos = convosData?.convos ?? [];

    const latestNotifications = useMemo(() => {
        const followerTypes = ['new_follower'];
        const activityTypes = [
            'video.like',
            'comment.like',
            'video.comment',
            'video.mention',
            'video.share',
        ];
        const systemTypes = ['system', 'admin.notification', 'system.update', 'system.message'];

        return {
            followers: notifications.find((n) => followerTypes.includes(n.type)),
            activity: notifications.find((n) => activityTypes.includes(n.type)),
            system: notifications.find((n) => systemTypes.includes(n.type)),
        };
    }, [notifications]);

    const categories = [
        {
            id: 'followers',
            icon: 'people' as const,
            iconColor: '#FFFFFF',
            iconBgColor: '#00B8FF',
            title: 'New followers',
            subtitle: latestNotifications.followers
                ? getNotificationMessage(latestNotifications.followers)
                : 'See your new followers here.',
            count: unreadCounts.followers,
            route: '/private/notifications/followers',
        },
        {
            id: 'activity',
            icon: 'notifications' as const,
            iconColor: '#FFFFFF',
            iconBgColor: LOOP_ACCENT,
            title: 'Activities',
            subtitle: latestNotifications.activity
                ? getNotificationMessage(latestNotifications.activity)
                : 'See notifications here.',
            count: unreadCounts.activity,
            route: '/private/notifications/activity',
        },
        ...(unreadCounts.system > 0
            ? [
                  {
                      id: 'system',
                      icon: 'megaphone' as const,
                      iconColor: '#FFFFFF',
                      iconBgColor: '#FFA800',
                      title: 'System notifications',
                      subtitle: 'Tap to view your system notifications.',
                      count: unreadCounts.system,
                      route: '/private/notifications/system',
                  },
              ]
            : []),
        ...(unreadCounts.starterKits > 0
            ? [
                  {
                      id: 'starterKits',
                      icon: 'sparkles' as const,
                      iconColor: '#FFFFFF',
                      iconBgColor: '#8B5CF6',
                      title: 'Starter Kits',
                      subtitle: 'You have pending starter kit updates.',
                      count: unreadCounts.starterKits,
                      route: '/private/notifications/starterKits',
                  },
              ]
            : []),
    ];

    const suggestedAccounts = accountsData || [];
    const loading = isLoading || convosLoading;

    return (
        <View style={tw`flex-1 bg-white dark:bg-black`}>
            <Stack.Screen
                options={{
                    headerTitle: 'Inbox',
                    title: 'Inbox',
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                    headerTitleStyle: {
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: isDark ? '#fff' : '#000',
                    },
                    headerBackTitle: 'Back',
                    headerShadowVisible: false,
                    headerBackTitleVisible: false,
                    headerShown: true,
                    headerRight,
                }}
            />

            {loading ? (
                <YStack flex={1} alignItems="center" justifyContent="center">
                    <ActivityIndicator size="large" color={isDark ? '#fff' : LOOP_ACCENT} />
                </YStack>
            ) : (
                <ScrollView
                    refreshControl={
                        <RefreshControl
                            refreshing={(isRefetching || isFetching) && !isLoading}
                            onRefresh={handleRefresh}
                            tintColor={isDark ? '#fff' : LOOP_ACCENT}
                        />
                    }>
                    {isError ? (
                        <View style={tw`px-4 py-6`}>
                            <StackText
                                fontSize="$4"
                                textColor="text-gray-600 dark:text-gray-400"
                                style={{ textAlign: 'center' }}>
                                Unable to load inbox. Pull down to refresh.
                            </StackText>
                        </View>
                    ) : null}

                    <View style={tw`px-4 pt-3 pb-1`}>
                        <StackText
                            fontSize="$5"
                            fontWeight="semibold"
                            textColor="text-black dark:text-gray-300">
                            Messages
                        </StackText>
                    </View>

                    {convos.length === 0 ? (
                        <View style={tw`px-4 py-4`}>
                            <StackText fontSize="$3" textColor="text-gray-500 dark:text-gray-500">
                                No conversations yet. Message someone from their profile.
                            </StackText>
                        </View>
                    ) : (
                        convos.map((convo) => (
                            <ConvoRow
                                key={convo.id}
                                convo={convo}
                                myDid={myDid}
                                onPress={() =>
                                    router.push(`/private/messages/${convo.id}` as any)
                                }
                            />
                        ))
                    )}

                    <View style={tw`px-4 pt-5 pb-1 mt-2 border-t border-gray-100 dark:border-gray-900`}>
                        <StackText
                            fontSize="$5"
                            fontWeight="semibold"
                            textColor="text-black dark:text-gray-300">
                            Notifications
                        </StackText>
                    </View>

                    {categories.map((category) => (
                        <CategoryCard
                            key={category.id}
                            icon={category.icon}
                            iconColor={category.iconColor}
                            iconBgColor={category.iconBgColor}
                            title={category.title}
                            subtitle={category.subtitle}
                            count={category.count}
                            onPress={() => router.push(category.route as any)}
                        />
                    ))}

                    {suggestedAccounts.length > 0 ? (
                        <View style={tw`my-6`}>
                            <View style={tw`px-4 py-2`}>
                                <StackText
                                    fontSize="$5"
                                    fontWeight="semibold"
                                    textColor="text-black dark:text-gray-400">
                                    Suggested accounts
                                </StackText>
                            </View>
                            {suggestedAccounts.map((account: any) => (
                                <SuggestedAccountCard
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
                    ) : null}
                </ScrollView>
            )}
        </View>
    );
}
