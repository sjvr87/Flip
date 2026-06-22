import {
    ActivityFilterChips,
    type ActivityHubFilter,
} from '@/components/notifications/ActivityFilterChips';
import { FollowerNotificationRow } from '@/components/notifications/FollowerNotificationRow';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { SuggestedAccountsSection } from '@/components/notifications/SuggestedAccountsSection';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText, YStack } from '@/components/ui/Stack';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { useTheme } from '@/contexts/ThemeContext';
import { navigateFromNotification } from '@/utils/notificationNavigation';
import { useNotificationStore } from '@/utils/notificationStore';
import { toProfilePath } from '@/utils/profileNavigation';
import {
    fetchActivityNotifications,
    fetchFollowerNotifications,
    followAccount,
    notificationMarkAsRead,
    notificationTypeMarkAllAsRead,
} from '@/utils/requests';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    TouchableOpacity,
    View,
} from 'react-native';
import tw from 'twrnc';

type MainTab = 'activity' | 'followers';

const FOLLOWERS_COLLAPSED_COUNT = 5;

export default function NotificationsHubScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ tab?: string }>();
    const queryClient = useQueryClient();
    const { isDark } = useTheme();
    const {
        markActivityViewed,
        markActivityNotificationRead,
        clearActivityUnread,
        refetchBadgeCount,
    } = useNotificationStore();

    const initialTab: MainTab = params.tab === 'followers' ? 'followers' : 'activity';
    const [mainTab, setMainTab] = useState<MainTab>(initialTab);
    const [activityFilter, setActivityFilter] = useState<ActivityHubFilter>('activity');
    const [followersExpanded, setFollowersExpanded] = useState(false);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);
    const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

    const {
        data: activityData,
        fetchNextPage: fetchNextActivity,
        hasNextPage: hasNextActivity,
        isFetchingNextPage: isFetchingNextActivity,
        refetch: refetchActivity,
        isLoading: activityLoading,
        isRefetching: activityRefetching,
    } = useInfiniteQuery({
        queryKey: ['activity-notifications', activityFilter],
        queryFn: ({ pageParam, queryKey }) =>
            fetchActivityNotifications({ pageParam, type: queryKey[1] as string }),
        initialPageParam: undefined,
        staleTime: 0,
        refetchOnWindowFocus: true,
        enabled: mainTab === 'activity',
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    });

    const {
        data: followerData,
        fetchNextPage: fetchNextFollowers,
        hasNextPage: hasNextFollowers,
        isFetchingNextPage: isFetchingNextFollowers,
        refetch: refetchFollowers,
        isLoading: followersLoading,
        isRefetching: followersRefetching,
    } = useInfiniteQuery({
        queryKey: ['follower-notifications'],
        queryFn: fetchFollowerNotifications,
        initialPageParam: undefined,
        refetchOnWindowFocus: false,
        enabled: mainTab === 'followers',
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    });

    const activityNotifications = useMemo(() => {
        if (!activityData?.pages?.length) return [];
        return activityData.pages.flatMap((p: any) => p?.data ?? []);
    }, [activityData]);

    const followerNotifications = useMemo(() => {
        if (!followerData?.pages?.length) return [];
        return followerData.pages.flatMap((p: any) => p?.data ?? []);
    }, [followerData]);

    const visibleFollowers = useMemo(() => {
        if (followersExpanded) return followerNotifications;
        return followerNotifications.slice(0, FOLLOWERS_COLLAPSED_COUNT);
    }, [followerNotifications, followersExpanded]);

    const showFollowersExpand =
        !followersExpanded && followerNotifications.length > FOLLOWERS_COLLAPSED_COUNT;

    const activityReadMutation = useMutation({
        mutationFn: notificationMarkAsRead,
        onMutate: async (notificationId) => {
            const queryKey = ['activity-notifications', activityFilter];
            await queryClient.cancelQueries({ queryKey });

            const previousData = queryClient.getQueryData(queryKey);
            let notificationType: string | undefined;

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old?.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        data: page.data?.map((notification: any) => {
                            if (notification.id === notificationId) {
                                notificationType = notification.type;
                                return {
                                    ...notification,
                                    read_at: new Date().toISOString(),
                                };
                            }
                            return notification;
                        }),
                    })),
                };
            });

            if (notificationType) {
                markActivityNotificationRead(notificationType);
            }

            return { previousData, queryKey, notificationType };
        },
        onError: (err, _notificationId, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(context.queryKey, context.previousData);
            }
            console.error('Failed to mark notification as read:', err);
        },
        onSuccess: () => {
            queryClient.setQueryData(['main-notifications'], (old: any) => {
                if (!old?.meta?.unread_counts) return old;
                const activity = Math.max(0, (old.meta.unread_counts.activity ?? 0) - 1);
                return {
                    ...old,
                    meta: {
                        ...old.meta,
                        unread_counts: {
                            ...old.meta.unread_counts,
                            activity,
                        },
                    },
                };
            });
        },
    });

    const followerReadMutation = useMutation({
        mutationFn: notificationMarkAsRead,
        onMutate: async (notificationId) => {
            await queryClient.cancelQueries({ queryKey: ['follower-notifications'] });
            const previousData = queryClient.getQueryData(['follower-notifications']);

            queryClient.setQueryData(['follower-notifications'], (old: any) => {
                if (!old?.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        data: page.data?.map((notification: any) =>
                            notification.id === notificationId
                                ? { ...notification, read_at: new Date().toISOString() }
                                : notification,
                        ),
                    })),
                };
            });

            return { previousData };
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: ['follower-notifications'] });
            refetchBadgeCount();
            await queryClient.invalidateQueries({ queryKey: ['main-notifications'] });
        },
        onError: (err, _notificationId, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['follower-notifications'], context.previousData);
            }
            console.error('Failed to mark notification as read:', err);
        },
    });

    const markAllActivityReadMutation = useMutation({
        mutationFn: () => notificationTypeMarkAllAsRead(activityFilter),
        onMutate: async () => {
            const queryKey = ['activity-notifications', activityFilter];
            await queryClient.cancelQueries({ queryKey: ['main-notifications'] });
            await queryClient.cancelQueries({ queryKey });

            const previousMainData = queryClient.getQueryData(['main-notifications']);
            const previousActivityData = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(['main-notifications'], (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    meta: {
                        ...old.meta,
                        unread_counts: {
                            ...old.meta?.unread_counts,
                            activity: 0,
                        },
                    },
                };
            });

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old?.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        data: page.data?.map((notification: any) => ({
                            ...notification,
                            read_at: notification.read_at || new Date().toISOString(),
                        })),
                    })),
                };
            });

            clearActivityUnread();

            return { previousMainData, previousActivityData, queryKey };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousMainData) {
                queryClient.setQueryData(['main-notifications'], context.previousMainData);
            }
            if (context?.previousActivityData) {
                queryClient.setQueryData(context.queryKey, context.previousActivityData);
            }
        },
        onSuccess: () => {
            queryClient.setQueryData(['main-notifications'], (old: any) => {
                if (!old?.meta?.unread_counts) return old;
                return {
                    ...old,
                    meta: {
                        ...old.meta,
                        unread_counts: {
                            ...old.meta.unread_counts,
                            activity: 0,
                        },
                    },
                };
            });
        },
    });

    const acceptMutation = useMutation({
        mutationFn: async ({ actorId, notificationId }: { actorId: string; notificationId: string }) => {
            setAcceptingId(actorId);
            await followAccount(actorId);
            return notificationId;
        },
        onSuccess: (notificationId, { actorId }) => {
            setAcceptedIds((prev) => new Set(prev).add(actorId));
            if (notificationId) {
                followerReadMutation.mutate(notificationId);
            }
        },
        onSettled: () => setAcceptingId(null),
    });

    useFocusEffect(
        useCallback(() => {
            if (mainTab !== 'activity') return;
            clearActivityUnread();
            void markActivityViewed().then(() => {
                queryClient.setQueryData(['main-notifications'], (old: any) => {
                    if (!old?.meta?.unread_counts) return old;
                    return {
                        ...old,
                        meta: {
                            ...old.meta,
                            unread_counts: {
                                ...old.meta.unread_counts,
                                activity: 0,
                            },
                        },
                    };
                });
                void refetchActivity();
            });
        }, [clearActivityUnread, mainTab, markActivityViewed, queryClient, refetchActivity]),
    );

    const handleActivityPress = async (item: any) => {
        if (!item.read_at) {
            activityReadMutation.mutate(item.id);
        }
        await navigateFromNotification(router, item);
    };

    const handleActivityProfilePress = (account: any, item: any) => {
        if (!item.read_at) {
            activityReadMutation.mutate(item.id);
        }
        if (account?.id) {
            router.push(toProfilePath(account.id));
        }
    };

    const handleFollowerPress = async (item: any) => {
        if (!item.read_at) {
            followerReadMutation.mutate(item.id);
        }
        await navigateFromNotification(router, item);
    };

    const handleMarkAllActivityRead = () => {
        Alert.alert('Mark All as Read', 'Mark all activity notifications as read?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Mark All Read',
                style: 'destructive',
                onPress: () => markAllActivityReadMutation.mutate(),
            },
        ]);
    };

    const renderMainTabs = () => (
        <View style={tw`flex-row mx-4 mt-2 mb-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900`}>
            {(['activity', 'followers'] as MainTab[]).map((tab) => {
                const active = mainTab === tab;
                return (
                    <PressableHaptics
                        key={tab}
                        onPress={() => setMainTab(tab)}
                        style={[
                            tw`flex-1 py-2.5 rounded-lg items-center`,
                            active && { backgroundColor: isDark ? '#1c1c1e' : '#fff' },
                        ]}>
                        <StackText
                            fontSize="$4"
                            fontWeight={active ? 'semibold' : 'normal'}
                            style={{ color: active ? LOOP_ACCENT : isDark ? '#a1a1a6' : '#6b7280' }}>
                            {tab === 'activity' ? 'Activity' : 'New Followers'}
                        </StackText>
                    </PressableHaptics>
                );
            })}
        </View>
    );

    const renderEmpty = (loading: boolean) =>
        loading ? (
            <YStack paddingVertical="$8" alignItems="center">
                <ActivityIndicator size="large" color={LOOP_ACCENT} />
            </YStack>
        ) : (
            <YStack paddingY="$8" alignItems="center" justifyContent="center">
                <StackText fontSize="$4" textColor="text-gray-500 dark:text-gray-400">
                    {mainTab === 'activity' ? 'No activity yet' : 'No new followers yet'}
                </StackText>
            </YStack>
        );

    const listHeader = (
        <View>
            {renderMainTabs()}
            {mainTab === 'activity' ? (
                <ActivityFilterChips selected={activityFilter} onSelect={setActivityFilter} />
            ) : null}
            {mainTab === 'followers' && followerNotifications.length > 0 ? (
                <View style={tw`px-4 pb-2`}>
                    <StackText fontSize="$3" textColor="text-gray-500 dark:text-gray-500">
                        {followerNotifications.length} new follower
                        {followerNotifications.length === 1 ? '' : 's'}
                    </StackText>
                </View>
            ) : null}
        </View>
    );

    const activityListFooter = isFetchingNextActivity ? (
        <YStack paddingVertical="$6" alignItems="center">
            <ActivityIndicator color={LOOP_ACCENT} />
        </YStack>
    ) : null;

    const followersListFooter = (
        <View>
            {showFollowersExpand ? (
                <PressableHaptics
                    onPress={() => setFollowersExpanded(true)}
                    style={tw`py-4 items-center`}>
                    <StackText fontSize="$4" fontWeight="semibold" style={{ color: LOOP_ACCENT }}>
                        View all {followerNotifications.length} followers
                    </StackText>
                </PressableHaptics>
            ) : null}
            {followersExpanded && followerNotifications.length > FOLLOWERS_COLLAPSED_COUNT ? (
                <PressableHaptics
                    onPress={() => setFollowersExpanded(false)}
                    style={tw`py-3 items-center`}>
                    <StackText fontSize="$3" fontWeight="semibold" style={{ color: LOOP_ACCENT }}>
                        Show less
                    </StackText>
                </PressableHaptics>
            ) : null}
            {followersExpanded && hasNextFollowers && !isFetchingNextFollowers ? (
                <PressableHaptics
                    onPress={() => fetchNextFollowers()}
                    style={tw`py-4 items-center`}>
                    <StackText fontSize="$4" fontWeight="semibold" style={{ color: LOOP_ACCENT }}>
                        View more
                    </StackText>
                </PressableHaptics>
            ) : null}
            {isFetchingNextFollowers ? (
                <YStack paddingVertical="$6" alignItems="center">
                    <ActivityIndicator color={LOOP_ACCENT} />
                </YStack>
            ) : null}
            {mainTab === 'followers' ? <SuggestedAccountsSection /> : null}
        </View>
    );

    const activityList = (
        <FlatList
            key="activity"
            data={activityNotifications}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <NotificationItem
                    item={item}
                    onPress={handleActivityPress}
                    onProfilePress={handleActivityProfilePress}
                />
            )}
            ListHeaderComponent={listHeader}
            ListFooterComponent={activityListFooter}
            ListEmptyComponent={renderEmpty(activityLoading)}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
                if (hasNextActivity && !isFetchingNextActivity && !activityRefetching) {
                    fetchNextActivity();
                }
            }}
            refreshing={activityRefetching && !isFetchingNextActivity}
            onRefresh={() => refetchActivity()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
        />
    );

    const followersList = (
        <FlatList
            key="followers"
            data={visibleFollowers}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <FollowerNotificationRow
                    item={item}
                    onPress={() => handleFollowerPress(item)}
                    onProfilePress={() => {
                        if (!item.read_at) followerReadMutation.mutate(item.id);
                        router.push(toProfilePath(item.actor.id));
                    }}
                    onAccept={() =>
                        acceptMutation.mutate({
                            actorId: item.actor.id,
                            notificationId: item.id,
                        })
                    }
                    isAccepting={acceptingId === item.actor.id}
                    isAccepted={acceptedIds.has(item.actor.id)}
                />
            )}
            ListHeaderComponent={listHeader}
            ListFooterComponent={followersListFooter}
            ListEmptyComponent={renderEmpty(followersLoading)}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
                if (
                    followersExpanded &&
                    hasNextFollowers &&
                    !isFetchingNextFollowers &&
                    !followersRefetching
                ) {
                    fetchNextFollowers();
                }
            }}
            refreshing={followersRefetching && !isFetchingNextFollowers}
            onRefresh={() => refetchFollowers()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
        />
    );

    const currentList = mainTab === 'activity' ? activityList : followersList;
    const showMarkAllRead =
        mainTab === 'activity' && activityNotifications.length > 0 && !markAllActivityReadMutation.isPending;

    return (
        <View style={tw`flex-1 bg-white dark:bg-black`}>
            <Stack.Screen
                options={{
                    headerTitle: 'Notifications',
                    headerBackTitle: 'Back',
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.push('/(tabs)');
                                }
                            }}
                            style={tw`px-1`}>
                            <Ionicons
                                name="chevron-back"
                                size={24}
                                color={isDark ? '#fff' : '#000'}
                            />
                        </TouchableOpacity>
                    ),
                    headerRight: () =>
                        showMarkAllRead ? (
                            <PressableHaptics
                                onPress={handleMarkAllActivityRead}
                                style={tw`flex justify-center items-center w-10`}>
                                <Ionicons name="checkmark-done-outline" size={24} color={LOOP_ACCENT} />
                            </PressableHaptics>
                        ) : null,
                }}
            />
            {currentList}
        </View>
    );
}
