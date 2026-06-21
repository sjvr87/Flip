import AccountHeader from '@/components/profile/AccountHeader';
import AccountTabs from '@/components/profile/AccountTabs';
import ProfilePlaylists from '@/components/profile/ProfilePlaylists';
import VideoGrid from '@/components/profile/VideoGrid';
import { ReportModal } from '@/components/ReportModal';
import { StackText, YStack } from '@/components/ui/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import {
    blockAccount as atprotoBlockAccount,
    cancelFollowRequest as atprotoCancelFollowRequest,
    fetchAccount as atprotoFetchAccount,
    fetchAccountState as atprotoFetchAccountState,
    fetchUserVideos as atprotoFetchUserVideos,
    followAccount as atprotoFollowAccount,
    unblockAccount as atprotoUnblockAccount,
    unfollowAccount as atprotoUnfollowAccount,
} from '@/atproto';
import {
    blockAccount,
    cancelFollowRequest,
    fetchAccount,
    fetchAccountPlaylists,
    fetchAccountState,
    fetchUserVideos,
    followAccount,
    unblockAccount,
    unfollowAccount,
    usesAtprotoBackend,
} from '@/utils/requests';
import { decodeRouteParam, toPlaylistFeedRoute, toProfileFeedPath } from '@/utils/profileNavigation';
import { shareContent } from '@/utils/sharer';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { memo, useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import tw from 'twrnc';

const EmptyVideos = memo(({ activeTab }) => (
    <YStack paddingY="$8" alignItems="center" justifyContent="center">
        <StackText fontSize="$4" style={tw`dark:text-gray-400`}>
            {activeTab === 'videos' && 'No posts yet'}
            {activeTab === 'favorites' && 'No favorites yet'}
            {activeTab === 'reblogs' && 'No reblogs yet'}
        </StackText>
    </YStack>
));

const LoadingIndicator = memo(() => (
    <YStack paddingY="$8" alignItems="center">
        <ActivityIndicator size="large" color="#22D3EE" />
    </YStack>
));

const FooterLoader = memo(() => (
    <YStack paddingY="$6" alignItems="center">
        <ActivityIndicator color="#22D3EE" />
    </YStack>
));

export default function ProfileScreen() {
    const { id: rawId } = useLocalSearchParams();
    const id = decodeRouteParam(rawId);
    const atproto = usesAtprotoBackend();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('videos');
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [sortBy, setSortBy] = useState('Latest');
    const { isDark } = useTheme();

    const {
        data: user,
        isLoading: userLoading,
        error: userError,
    } = useQuery({
        queryKey: ['fetchAccount', id?.toString()],
        queryFn: async () => {
            const res = atproto
                ? await atprotoFetchAccount(id)
                : await fetchAccount(id.toString());
            return res.data;
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });

    const { data: userState, refetch: refetchUserState } = useQuery({
        queryKey: ['fetchAccountState', id?.toString()],
        queryFn: async () => {
            const res = atproto
                ? await atprotoFetchAccountState(id)
                : await fetchAccountState(id.toString());
            return res.data;
        },
        enabled: !!user && !!id,
        staleTime: 2 * 60 * 1000,
    });

    const { data: playlists, isLoading: playlistsLoading } = useQuery({
        queryKey: ['accountPlaylists', id?.toString()],
        queryFn: async () => {
            const res = await fetchAccountPlaylists(id.toString());
            return res.data;
        },
        enabled: !!user?.has_playlists && !!id && !atproto,
        staleTime: 5 * 60 * 1000,
    });

    const {
        data: videosData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
        isLoading: videosLoading,
        isError: videosError,
    } = useInfiniteQuery({
        queryKey: ['userVideos', id?.toString(), sortBy],
        queryFn: atproto ? atprotoFetchUserVideos : fetchUserVideos,
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage?.meta?.next_cursor ?? undefined,
        enabled: !!user && !!id,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    const videos = useMemo(() => {
        if (!videosData?.pages) return [];
        return videosData.pages.flatMap((page) => page?.data ?? []);
    }, [videosData?.pages]);

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const followMutation = useMutation({
        mutationFn: async () => {
            if (!id) throw new Error('No user ID');

            if (userState?.pending_follow_request) {
                return atproto
                    ? (await atprotoCancelFollowRequest(id)).data
                    : (await cancelFollowRequest(id.toString())).data;
            } else if (userState?.following) {
                return atproto
                    ? (await atprotoUnfollowAccount(id)).data
                    : (await unfollowAccount(id.toString())).data;
            } else {
                return atproto
                    ? (await atprotoFollowAccount(id)).data
                    : (await followAccount(id.toString())).data;
            }
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['fetchAccountState', id?.toString()] });
        },
        onSuccess: async () => {
            await refetchUserState();
            queryClient.invalidateQueries({ queryKey: ['fetchAccount', id?.toString()] });
        },
        onError: (error) => {
            console.error('Follow action failed:', error);
            Alert.alert('Error', 'Failed to update follow status. Please try again.');
        },
    });

    const blockMutation = useMutation({
        mutationFn: async () => {
            if (!id) throw new Error('No user ID');

            if (userState?.blocking) {
                return atproto
                    ? (await atprotoUnblockAccount(id)).data
                    : (await unblockAccount(id.toString())).data;
            } else {
                return atproto
                    ? (await atprotoBlockAccount(id)).data
                    : (await blockAccount(id.toString())).data;
            }
        },
        onSuccess: async () => {
            await refetchUserState();
            setShowMenuModal(false);
        },
        onError: (error) => {
            console.error('Block action failed:', error);
            Alert.alert('Error', 'Failed to update block status. Please try again.');
        },
    });

    const handleVideoPress = useCallback(
        (video) => {
            if (!video?.id || !video?.account?.id) return;
            router.push(toProfileFeedPath(video.id, video.account.id));
        },
        [router],
    );

    const handleOnOpenMenu = useCallback(() => {
        setShowMenuModal(true);
    }, []);

    const handleBlockPress = useCallback(() => {
        if (!user || blockMutation.isPending) return;

        setShowMenuModal(false);

        if (userState?.blocking) {
            Alert.alert('Unblock User', `Unblock @${user.username}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unblock', onPress: () => blockMutation.mutate() },
            ]);
        } else {
            Alert.alert(
                'Block User',
                `Block @${user.username}? They won't be able to see your profile or contact you.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Block', style: 'destructive', onPress: () => blockMutation.mutate() },
                ],
            );
        }
    }, [user, userState?.blocking, blockMutation]);

    const handleReportPress = useCallback(() => {
        setShowMenuModal(false);
        setShowReportModal(true);
    }, []);

    const handleCommunityGuidelines = useCallback(() => {
        setShowReportModal(false);
        router.push('/private/settings/legal/community');
    }, [router]);

    const handlePlaylistPress = useCallback(
        (playlist) => {
            const route = toPlaylistFeedRoute(playlist);
            if (route) router.push(route);
        },
        [router],
    );

    const handleAccountShare = useCallback(async () => {
        if (!user) return;

        try {
            await shareContent({
                message: `Check out @${user.username}'s account on Flip!`,
                url: user.url,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    }, [user]);

    const handleOpenInBrowser = async () => {
        if (!user) return;

        await WebBrowser.openBrowserAsync(user.remote_url ?? user.url, {
            presentationStyle: 'pageSheet',
        });
    };

    const handleOnUnblockPress = useCallback(() => {
        if (!user || !userState?.blocking || blockMutation.isPending) return;

        Alert.alert('Unblock User', `Are you sure you want to unblock @${user.username}?`, [
            { text: 'No', style: 'cancel' },
            { text: 'Unblock', style: 'destructive', onPress: () => blockMutation.mutate() },
        ]);
    }, [user, userState?.blocking, blockMutation]);

    const handleOnFollowPress = useCallback(() => {
        if (!user || followMutation.isPending) return;

        if (userState?.pending_follow_request) {
            Alert.alert(
                'Cancel Follow Request',
                `Cancel your follow request to @${user.username}?`,
                [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes', style: 'destructive', onPress: () => followMutation.mutate() },
                ],
            );
        } else if (userState?.following) {
            Alert.alert('Unfollow', `Unfollow @${user.username}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unfollow', style: 'destructive', onPress: () => followMutation.mutate() },
            ]);
        } else {
            followMutation.mutate();
        }
    }, [user, userState, followMutation]);

    const renderEmpty = useCallback(() => {
        if (videosLoading) {
            return <LoadingIndicator />;
        }
        return <EmptyVideos activeTab={activeTab} />;
    }, [videosLoading, activeTab]);

    const renderFooter = useCallback(() => {
        return isFetchingNextPage ? <FooterLoader /> : null;
    }, [isFetchingNextPage]);

    const renderItem = useCallback(
        ({ item }) => <VideoGrid video={item} onPress={handleVideoPress} />,
        [handleVideoPress],
    );

    const keyExtractor = useCallback((item) => item?.id?.toString() ?? '', []);

    if (userLoading) {
        return (
            <View style={tw`flex-1 bg-white dark:bg-black justify-center items-center`}>
                <Stack.Screen
                    options={{
                        title: user?.name || 'Profile',
                        headerStyle: tw`bg-white dark:bg-black`,
                        headerTintColor: isDark ? '#fff' : '#000',
                        headerShadowVisible: false,
                        headerShown: true,
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
                    }}
                />
                <ActivityIndicator size="large" color="#22D3EE" />
            </View>
        );
    }

    if (userError || !user) {
        return (
            <View style={tw`flex-1 bg-white justify-center items-center px-6`}>
                <Text style={tw`text-base text-gray-900 text-center`}>
                    Unable to load profile. Please try again.
                </Text>
            </View>
        );
    }

    return (
        <View style={tw`flex-1 bg-white dark:bg-black`}>
            <Stack.Screen
                options={{
                    title: user?.name || 'Profile',
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                    headerShadowVisible: false,
                    headerShown: true,
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
                }}
            />

            <FlatList
                data={videos}
                numColumns={3}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListHeaderComponent={
                    <>
                        <AccountHeader
                            user={user}
                            userState={userState}
                            onFollowPress={handleOnFollowPress}
                            onMenuPress={handleOnOpenMenu}
                            onUnblockPress={handleOnUnblockPress}
                            isFollowLoading={followMutation.isPending}
                        />
                        <AccountTabs
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            sortBy={sortBy}
                            onSortChange={setSortBy}
                        />

                        {activeTab === 'videos' && user?.has_playlists ? (
                            <ProfilePlaylists
                                playlists={playlists}
                                isLoading={playlistsLoading}
                                onPlaylistPress={handlePlaylistPress}
                            />
                        ) : null}
                    </>
                }
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
                onEndReachedThreshold={0.4}
                onEndReached={handleEndReached}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                maxToRenderPerBatch={9}
                initialNumToRender={9}
                windowSize={5}
                updateCellsBatchingPeriod={50}
            />

            <Modal
                visible={showMenuModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMenuModal(false)}>
                <Pressable
                    style={tw`flex-1 bg-black/50 dark:bg-black/70 justify-end`}
                    onPress={() => setShowMenuModal(false)}>
                    <Pressable
                        style={tw`bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-t-3xl`}
                        onPress={(e) => e.stopPropagation()}>
                        <View style={tw`py-4`}>
                            <Pressable
                                style={tw`px-6 py-4 flex-row items-center`}
                                onPress={handleOpenInBrowser}>
                                <Text
                                    style={tw`text-base text-gray-900 dark:text-gray-300 font-medium`}>
                                    Open in browser
                                </Text>
                            </Pressable>

                            <View style={tw`h-px bg-gray-200 dark:bg-gray-800 mx-6`} />

                            <Pressable
                                style={tw`px-6 py-4 flex-row items-center`}
                                onPress={handleAccountShare}>
                                <Text
                                    style={tw`text-base text-gray-900 dark:text-gray-300 font-medium`}>
                                    Share
                                </Text>
                            </Pressable>

                            <View style={tw`h-px bg-gray-200 dark:bg-gray-800 mx-6`} />

                            <Pressable
                                style={tw`px-6 py-4 flex-row items-center`}
                                onPress={handleBlockPress}
                                disabled={blockMutation.isPending}>
                                <Text
                                    style={tw`text-base text-gray-900 dark:text-gray-300 font-medium ${blockMutation.isPending ? 'opacity-50' : ''}`}>
                                    {userState?.blocking ? 'Unblock' : 'Block'}
                                </Text>
                            </Pressable>

                            <View style={tw`h-px bg-gray-200 dark:bg-gray-800 mx-6`} />

                            <Pressable
                                style={tw`px-6 py-4 flex-row items-center`}
                                onPress={handleReportPress}>
                                <Text style={tw`text-base text-red-600 font-medium`}>Report</Text>
                            </Pressable>

                            <View style={tw`mt-2 border-t border-gray-200 dark:border-gray-800`}>
                                <Pressable
                                    style={tw`px-6 py-4`}
                                    onPress={() => setShowMenuModal(false)}>
                                    <Text
                                        style={tw`text-base text-gray-600 dark:text-white font-medium text-center`}>
                                        Cancel
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <ReportModal
                visible={showReportModal}
                userState={userState}
                onClose={() => setShowReportModal(false)}
                onCommunityGuidelines={handleCommunityGuidelines}
                reportType="profile"
                item={user}
            />
        </View>
    );
}
