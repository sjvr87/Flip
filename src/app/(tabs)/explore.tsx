import Avatar from '@/components/Avatar';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { XStack } from '@/components/ui/Stack';
import {
    followAccount,
    getExploreAccounts,
    getExploreTags,
    getExploreTagsFeed,
    postExploreAccountHideSuggestion,
} from '@/atproto';
import { useTheme } from '@/contexts/ThemeContext';
import {
    EXPLORE_DEFAULT_TAG,
    EXPLORE_GC_MS,
    EXPLORE_STALE_MS,
    readExploreAccountsCache,
    readExploreFeedCache,
    readExploreTagsCache,
    writeExploreAccountsCache,
    writeExploreFeedCache,
    writeExploreTagsCache,
} from '@/utils/exploreCache';
import { toProfileFeedPath, toProfilePath } from '@/utils/profileNavigation';
import { Feather } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';

const { width } = Dimensions.get('window');
const ACCOUNT_CARD_WIDTH = 160;
const TAG_CARD_WIDTH = 120;
const VIDEO_THUMBNAIL_WIDTH = (width - 24) / 3;

interface Tag {
    id: number;
    name: string;
    count: number;
}

interface Account {
    id: string;
    name: string;
    avatar: string;
    username: string;
    bio: string;
    follower_count: number;
    post_count?: number;
}

interface Video {
    id: string;
    hid: string;
    account: {
        id: string;
        name: string;
        username: string;
        avatar: string;
    } | null;
    caption: string;
    url: string;
    likes: number;
    comments: number;
    media: {
        duration: number;
        width: number;
        height: number;
        thumbnail: string;
    } | null;
}

const isValidAccount = (account: Account | null | undefined): account is Account => {
    return !!(account?.id && account?.username && account?.name);
};

const isValidVideo = (video: Video | null | undefined): video is Video => {
    return !!(
        video?.id &&
        video?.account?.id &&
        video?.account?.username &&
        video?.media?.thumbnail
    );
};

const isValidTag = (tag: Tag | null | undefined): tag is Tag => {
    return !!(tag?.id && tag?.name && typeof tag?.count === 'number');
};

function SectionSkeleton({ height = 120 }: { height?: number }) {
    return (
        <View style={tw`mx-4 my-3 rounded-xl bg-gray-100 dark:bg-gray-900`}>
            <View style={{ height }} />
        </View>
    );
}

function AccountCardSkeleton() {
    return (
        <View
            style={[
                tw`mr-3 rounded-xl bg-gray-100 dark:bg-gray-900`,
                { width: ACCOUNT_CARD_WIDTH, height: 200 },
            ]}
        />
    );
}

function VideoThumbnailSkeleton() {
    return (
        <View
            style={[
                tw`mb-1 rounded-lg bg-gray-100 dark:bg-gray-900`,
                {
                    width: VIDEO_THUMBNAIL_WIDTH - 4,
                    height: ((VIDEO_THUMBNAIL_WIDTH - 4) * 16) / 9,
                },
            ]}
        />
    );
}

export default function ExploreScreen() {
    const router = useRouter();
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [followingAccountId, setFollowingAccountId] = useState<string | null>(null);
    const [hidingAccountId, setHidingAccountId] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const { isDark } = useTheme();

    const exploreQueryOptions = {
        staleTime: EXPLORE_STALE_MS,
        gcTime: EXPLORE_GC_MS,
        refetchOnWindowFocus: false,
    };

    const {
        data: tagsData,
        isLoading: tagsLoading,
        isError: tagsError,
        refetch: refetchTags,
        isRefetching: tagsRefetching,
    } = useQuery({
        queryKey: ['explore', 'tags'],
        queryFn: async () => {
            const data = await getExploreTags();
            writeExploreTagsCache(data);
            return data;
        },
        placeholderData: readExploreTagsCache,
        retry: 2,
        ...exploreQueryOptions,
    });

    const {
        data: accountsData,
        isLoading: accountsLoading,
        isError: accountsError,
        refetch: refetchAccounts,
        isRefetching: accountsRefetching,
    } = useQuery({
        queryKey: ['accounts', 'suggested'],
        queryFn: async () => {
            const data = await getExploreAccounts();
            writeExploreAccountsCache(data);
            return data;
        },
        placeholderData: readExploreAccountsCache,
        retry: 2,
        ...exploreQueryOptions,
    });

    const validTags = useMemo(() => {
        if (!Array.isArray(tagsData)) return [];
        return tagsData.filter(isValidTag);
    }, [tagsData]);

    const validAccounts = useMemo(() => {
        if (!Array.isArray(accountsData)) return [];
        return accountsData.filter(isValidAccount);
    }, [accountsData]);

    const feedTag = selectedTag ?? EXPLORE_DEFAULT_TAG;

    const {
        data: videosData,
        isLoading: videosLoading,
        isError: videosError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch: refetchVideos,
        isRefetching: videosRefetching,
    } = useInfiniteQuery({
        queryKey: ['explore', 'tag-feed', feedTag],
        queryFn: getExploreTagsFeed,
        getNextPageParam: (lastPage) => lastPage?.meta?.next_cursor,
        initialPageParam: null,
        placeholderData: () => {
            const cached = readExploreFeedCache(feedTag);
            if (!cached) return undefined;
            return { pages: cached.pages, pageParams: cached.pageParams };
        },
        retry: 2,
        ...exploreQueryOptions,
    });

    const followMutation = useMutation({
        mutationFn: async (profileId: string) => {
            setFollowingAccountId(profileId);
            return await followAccount(profileId);
        },
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['accounts', 'suggested'] });
        },
        onSettled: () => {
            setFollowingAccountId(null);
        },
    });

    const hideSuggestionMutation = useMutation({
        mutationFn: async (profileId: string) => {
            setHidingAccountId(profileId);
            return await postExploreAccountHideSuggestion(profileId);
        },
        onMutate: async (profileId) => {
            await queryClient.cancelQueries({ queryKey: ['accounts', 'suggested'] });

            const previousAccounts = queryClient.getQueryData(['accounts', 'suggested']);

            queryClient.setQueryData(['accounts', 'suggested'], (old: Account[] | undefined) => {
                return old?.filter((account) => account.id !== profileId) || [];
            });

            return { previousAccounts };
        },
        onError: (err, profileId, context) => {
            if (context?.previousAccounts) {
                queryClient.setQueryData(['accounts', 'suggested'], context.previousAccounts);
            }
        },
        onSettled: () => {
            setHidingAccountId(null);
            queryClient.invalidateQueries({ queryKey: ['accounts', 'suggested'] });
        },
    });

    const allVideos = useMemo(() => {
        if (!videosData?.pages) return [];
        return videosData.pages.flatMap((page) => page?.data || []).filter(isValidVideo);
    }, [videosData]);

    React.useEffect(() => {
        if (videosData?.pages?.length) {
            writeExploreFeedCache(feedTag, videosData.pages, videosData.pageParams);
        }
    }, [feedTag, videosData]);

    const renderAccountCard = useCallback(
        ({
            item,
            onHandleFollow,
            onHideSuggestion,
        }: {
            item: Account;
            onHandleFollow: () => void;
            onHideSuggestion: () => void;
        }) => {
            const isFollowing = followingAccountId === item.id;
            const isHiding = hidingAccountId === item.id;

            return (
                <View style={tw`mr-3 bg-gray-100 dark:bg-[#1c1c1e] rounded-xl overflow-hidden`}>
                    <View style={tw`w-[${ACCOUNT_CARD_WIDTH}px] p-3 items-center`}>
                        <PressableHaptics
                            style={tw`absolute top-2 right-2 z-10 bg-opacity-50 rounded-full p-1`}
                            onPress={onHideSuggestion}
                            disabled={isHiding}>
                            <Feather name="x" size={16} color="gray" />
                        </PressableHaptics>

                        <Avatar
                            url={item.avatar}
                            width={64}
                            onPress={() => router.push(toProfilePath(item.id))}
                        />

                        <Pressable onPress={() => router.push(toProfilePath(item.id))}>
                            <Text
                                style={tw`text-black font-semibold text-sm mb-1 mt-2 dark:text-white`}
                                numberOfLines={1}>
                                {item.name || item.username}
                            </Text>
                        </Pressable>

                        {item.bio && (
                            <Text
                                style={tw`text-gray-800 text-xs text-center mb-1 dark:text-gray-300`}
                                numberOfLines={1}>
                                {item.bio}
                            </Text>
                        )}

                        <XStack justifyContent="space-between" gap="$3" style={tw`w-full mb-3`}>
                            {typeof item.post_count === 'number' && (
                                <Text style={tw`text-gray-500 text-[11px] dark:text-gray-400`}>
                                    {item.post_count.toLocaleString()} videos
                                </Text>
                            )}
                            {typeof item.follower_count === 'number' && (
                                <Text style={tw`text-gray-500 text-[11px] dark:text-gray-400`}>
                                    {item.follower_count.toLocaleString()} followers
                                </Text>
                            )}
                        </XStack>

                        <PressableHaptics onPress={onHandleFollow} disabled={isFollowing}>
                            <View
                                style={[tw`rounded-full px-4 py-1.5`, { backgroundColor: '#F02C56' }]}>
                                <Text style={tw`text-white font-semibold text-xs`}>
                                    {isFollowing ? 'Following...' : 'Follow'}
                                </Text>
                            </View>
                        </PressableHaptics>
                    </View>
                </View>
            );
        },
        [followingAccountId, hidingAccountId, router],
    );

    const renderTagCard = useCallback(
        ({ item }: { item: Tag }) => {
            const isSelected = feedTag === item.name;
            return (
                <PressableHaptics
                    style={[
                        tw`mr-2.5 rounded-xl px-4 py-2.5`,
                        isSelected ? tw`bg-[#F02C56]` : tw`bg-gray-100 dark:bg-gray-900`,
                    ]}
                    onPress={() => setSelectedTag(item.name)}>
                    <View style={tw`w-[${TAG_CARD_WIDTH}px] items-center`}>
                        <Text
                            style={[
                                tw`font-bold text-base mb-0.5`,
                                isSelected ? tw`text-white` : tw`text-black dark:text-gray-400`,
                            ]}>
                            #{item.name}
                        </Text>
                        {item.count > 0 && (
                            <Text
                                style={[
                                    tw`text-xs`,
                                    isSelected ? tw`text-gray-200` : tw`text-gray-600`,
                                ]}>
                                {item.count.toLocaleString()} videos
                            </Text>
                        )}
                    </View>
                </PressableHaptics>
            );
        },
        [feedTag],
    );

    const renderVideoThumbnail = useCallback(
        ({ item, index }: { item: Video; index: number }) => {
            if (!item.account || !item.media) return null;

            const duration = item.media.duration || 0;
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);

            return (
                <TouchableOpacity
                    style={tw`mb-1 px-0.5`}
                    onPress={() => router.push(toProfileFeedPath(item.id, item.account!.id))}>
                    <View style={tw`relative`}>
                        <Image
                            source={item.media.thumbnail}
                            style={[
                                tw`rounded-lg bg-gray-900`,
                                {
                                    width: VIDEO_THUMBNAIL_WIDTH - 4,
                                    height: ((VIDEO_THUMBNAIL_WIDTH - 4) * 16) / 9,
                                },
                            ]}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            priority={index < 6 ? 'normal' : 'low'}
                            transition={index < 6 ? 150 : 0}
                            recyclingKey={item.id}
                        />
                        {item.caption && (
                            <View style={tw`absolute bottom-2 left-2 right-2`}>
                                <Text style={tw`text-white text-xs font-medium`} numberOfLines={2}>
                                    {item.caption}
                                </Text>
                            </View>
                        )}
                        <View
                            style={tw`absolute top-2 right-2 bg-black bg-opacity-70 rounded px-1.5 py-0.5`}>
                            <Text style={tw`text-white text-xs`}>
                                {minutes}:{seconds.toString().padStart(2, '0')}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        },
        [router],
    );

    const renderEmptyState = useCallback(
        (message: string) => (
            <View style={tw`py-10 items-center px-4`}>
                <Text style={tw`text-gray-500 dark:text-gray-400 text-center`}>{message}</Text>
            </View>
        ),
        [],
    );

    const showAccountsSkeleton = accountsLoading && validAccounts.length === 0;
    const showTagsSkeleton = tagsLoading && validTags.length === 0;
    const showVideosSkeleton = videosLoading && allVideos.length === 0;

    const listHeader = useMemo(
        () => (
            <>
                <View style={tw`px-4 pt-4 pb-3 flex justify-between items-center flex-row`}>
                    <Text style={tw`text-black text-4xl font-bold dark:text-white`}>Explore</Text>
                    <Pressable onPress={() => router.push('/private/search')}>
                        <Feather name="search" color={isDark ? '#fff' : '#000'} size={30} />
                    </Pressable>
                </View>

                <View style={tw`my-5`}>
                    <Text
                        style={tw`text-black text-lg font-bold px-4 mb-3 dark:text-gray-500`}>
                        Suggested for you
                    </Text>
                    {showAccountsSkeleton ? (
                        <FlatList
                            horizontal
                            data={[1, 2, 3]}
                            keyExtractor={(item) => `account-skel-${item}`}
                            renderItem={() => <AccountCardSkeleton />}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={tw`px-4`}
                        />
                    ) : validAccounts.length > 0 ? (
                        <FlatList
                            horizontal
                            data={validAccounts}
                            renderItem={({ item }) =>
                                renderAccountCard({
                                    item,
                                    onHandleFollow: () => followMutation.mutate(item.id),
                                    onHideSuggestion: () => hideSuggestionMutation.mutate(item.id),
                                })
                            }
                            keyExtractor={(item) => item.id}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={tw`px-4`}
                        />
                    ) : accountsError ? (
                        renderEmptyState(
                            'Unable to load suggested accounts. Pull down to refresh.',
                        )
                    ) : null}
                </View>

                <View style={tw`mb-4`}>
                    <Text
                        style={tw`text-black text-lg font-bold px-4 mb-3 dark:text-gray-500`}>
                        Trending
                    </Text>
                    {showTagsSkeleton ? (
                        <SectionSkeleton height={52} />
                    ) : validTags.length > 0 ? (
                        <FlatList
                            horizontal
                            data={validTags}
                            renderItem={renderTagCard}
                            keyExtractor={(item) => item.id.toString()}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={tw`px-4`}
                        />
                    ) : tagsError ? (
                        renderEmptyState('Unable to load trending topics. Please try again later.')
                    ) : null}
                </View>

                {showVideosSkeleton ? (
                    <View style={tw`flex-row flex-wrap px-2`}>
                        {Array.from({ length: 9 }, (_, i) => (
                            <View key={`video-skel-${i}`} style={tw`w-1/3 px-0.5`}>
                                <VideoThumbnailSkeleton />
                            </View>
                        ))}
                    </View>
                ) : null}
            </>
        ),
        [
            accountsError,
            showAccountsSkeleton,
            showTagsSkeleton,
            showVideosSkeleton,
            followMutation,
            hideSuggestionMutation,
            isDark,
            renderAccountCard,
            renderEmptyState,
            renderTagCard,
            router,
            tagsError,
            validAccounts,
            validTags,
        ],
    );

    const showEmptyExplore =
        !showAccountsSkeleton &&
        !showTagsSkeleton &&
        !showVideosSkeleton &&
        validTags.length === 0 &&
        validAccounts.length === 0 &&
        allVideos.length === 0;

    const listFooter = useMemo(() => {
        if (isFetchingNextPage) {
            return (
                <View style={tw`py-4 items-center`}>
                    <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
                </View>
            );
        }
        return <View style={tw`h-4`} />;
    }, [isDark, isFetchingNextPage]);

    const listEmpty = useMemo(() => {
        if (showVideosSkeleton) return null;
        if (videosError) {
            return renderEmptyState('Unable to load videos. Please try again later.');
        }
        if (showEmptyExplore) {
            return renderEmptyState(
                'Nothing to explore right now. Check your connection and try again.',
            );
        }
        if (validTags.length > 0 || feedTag) {
            return renderEmptyState('No video posts for this topic yet. Try another tag.');
        }
        return null;
    }, [
        feedTag,
        renderEmptyState,
        showEmptyExplore,
        showVideosSkeleton,
        validTags.length,
        videosError,
    ]);

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
        }
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    const handleRefresh = useCallback(() => {
        void refetchTags();
        void refetchAccounts();
        void refetchVideos();
    }, [refetchAccounts, refetchTags, refetchVideos]);

    const isRefreshing = tagsRefetching || accountsRefetching || videosRefetching;

    return (
        <SafeAreaView edges={['top']} style={tw`flex-1 bg-white dark:bg-black`}>
            <FlatList
                data={allVideos}
                numColumns={3}
                keyExtractor={(item) => item.id}
                renderItem={renderVideoThumbnail}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                ListEmptyComponent={listEmpty}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={tw`pb-4`}
                columnWrapperStyle={tw`px-2`}
                initialNumToRender={9}
                maxToRenderPerBatch={6}
                windowSize={3}
                removeClippedSubviews
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={isDark ? '#fff' : '#000'}
                    />
                }
            />
        </SafeAreaView>
    );
}
