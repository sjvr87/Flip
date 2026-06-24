import {
    ActivityFilterChips,
    type ActivityHubFilter,
} from '@/components/notifications/ActivityFilterChips';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { FollowersNotificationsPanel } from '@/components/notifications/FollowersNotificationsPanel';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText, YStack } from '@/components/ui/Stack';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { useTheme } from '@/contexts/ThemeContext';
import { navigateFromNotification } from '@/utils/notificationNavigation';
import { safeRouterPush } from '@/utils/safeNavigation';
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
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, Alert, FlatList, TouchableOpacity, View } from 'react-native';
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

    const routeTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const initialTab: MainTab = routeTab === 'followers' ? 'followers' : 'activity';
    const [mainTab, setMainTab] = useState<MainTab>(initialTab);

    useEffect(() => {
        if (routeTab === 'followers') setMainTab('followers');
        else if (routeTab === 'activity') setMainTab('activity');
    }, [routeTab]);
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
        mutationFn: async ({
            actorId,
            notificationId,
        }: {
            actorId: string;
            notificationId: string;
        }) => {
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
            safeRouterPush(toProfilePath(account.id));
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
                            style={{
                                color: active ? LOOP_ACCENT : isDark ? '#a1a1a6' : '#6b7280',
                            }}>
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

    const showMarkAllRead =
        mainTab === 'activity' &&
        activityNotifications.length > 0 &&
        !markAllActivityReadMutation.isPending;

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
                                    safeRouterPush('/(tabs)');
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
                                <Ionicons
                                    name="checkmark-done-outline"
                                    size={24}
                                    color={LOOP_ACCENT}
                                />
                            </PressableHaptics>
                        ) : null,
                }}
            />
            {renderMainTabs()}
            {mainTab === 'activity' ? (
                <>
                    <ActivityFilterChips selected={activityFilter} onSelect={setActivityFilter} />
                    <ActivityNotificationsPanel
                        key="activity-panel"
                        notifications={activityNotifications}
                        activityFilter={activityFilter}
                        onFilterChange={setActivityFilter}
                        isLoading={activityLoading}
                        isRefetching={activityRefetching}
                        isFetchingNextPage={isFetchingNextActivity}
                        hasNextPage={hasNextActivity}
                        onRefresh={refetchActivity}
                        onFetchNextPage={fetchNextActivity}
                        onPress={handleActivityPress}
                        onProfilePress={handleActivityProfilePress}
                        renderEmpty={renderEmpty(activityLoading)}
                    />
                </>
            ) : (
                <FollowersNotificationsPanel
                    key="followers-panel"
                    notifications={visibleFollowers}
                    totalFollowerCount={followerNotifications.length}
                    isLoading={followersLoading}
                    isRefetching={followersRefetching}
                    isFetchingNextPage={isFetchingNextFollowers}
                    hasNextPage={hasNextFollowers}
                    followersExpanded={followersExpanded}
                    showExpand={showFollowersExpand}
                    onExpand={() => setFollowersExpanded(true)}
                    onCollapse={() => setFollowersExpanded(false)}
                    onFetchNextPage={fetchNextFollowers}
                    onRefresh={refetchFollowers}
                    onPress={handleFollowerPress}
                    onProfilePress={(item) => {
                        if (!item.read_at) followerReadMutation.mutate(item.id);
                        safeRouterPush(toProfilePath(item.actor.id));
                    }}
                    onAccept={(item) =>
                        acceptMutation.mutate({
                            actorId: item.actor.id,
                            notificationId: item.id,
                        })
                    }
                    acceptingId={acceptingId}
                    acceptedIds={acceptedIds}
                    renderEmpty={renderEmpty(followersLoading)}
                />
            )}
        </View>
    );
}

type ActivityNotificationsPanelProps = {
    notifications: any[];
    activityFilter: ActivityHubFilter;
    onFilterChange: (filter: ActivityHubFilter) => void;
    isLoading: boolean;
    isRefetching: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean | undefined;
    onRefresh: () => void;
    onFetchNextPage: () => void;
    onPress: (item: any) => void;
    onProfilePress: (account: any, item: any) => void;
    renderEmpty: ReactElement;
};

function ActivityNotificationsPanel({
    notifications,
    activityFilter,
    onFilterChange,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    onRefresh,
    onFetchNextPage,
    onPress,
    onProfilePress,
    renderEmpty,
}: ActivityNotificationsPanelProps) {
    const listFooter = isFetchingNextPage ? (
        <YStack paddingVertical="$6" alignItems="center">
            <ActivityIndicator color={LOOP_ACCENT} />
        </YStack>
    ) : null;

    return (
        <FlatList
            key="activity-notifications"
            style={tw`flex-1`}
            data={notifications}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <NotificationItem item={item} onPress={onPress} onProfilePress={onProfilePress} />
            )}
            ListFooterComponent={listFooter}
            ListEmptyComponent={renderEmpty}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage && !isRefetching) {
                    onFetchNextPage();
                }
            }}
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
        />
    );
}
