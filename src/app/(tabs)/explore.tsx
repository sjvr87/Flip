import Avatar from '@/components/Avatar';
import LinkifiedCaption from '@/components/feed/LinkifiedCaption';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { getExploreTags, getExploreTagsFeed, getExploreTextPosts, videoLike, videoUnlike } from '@/atproto';
import type { FlipTextPost } from '@/atproto';
import { useTheme } from '@/contexts/ThemeContext';
import {
    EXPLORE_DEFAULT_TAG,
    EXPLORE_GC_MS,
    EXPLORE_STALE_MS,
    patchExploreTextPostLike,
    readExploreFeedCache,
    readExploreTagsCache,
    readExploreTextPostsCache,
    writeExploreFeedCache,
    writeExploreTagsCache,
    writeExploreTextPostsCache,
} from '@/utils/exploreCache';
import { toPostViewPath, toProfilePath } from '@/utils/profileNavigation';
import { prefetchThumbnails } from '@/utils/thumbnailPrefetch';
import { timeAgo } from '@/utils/ui';
import { Feather } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';

const { width } = Dimensions.get('window');
const TAG_CARD_WIDTH = 120;
const TEXT_POST_CARD_WIDTH = Math.min(300, width * 0.78);
const TEXT_POST_CARD_GAP = 12;
const NETWORK_POSTS_MAX_HEIGHT = 228;
const VIDEO_THUMBNAIL_WIDTH = (width - 24) / 3;

function estimateTextPostCardHeight(post: FlipTextPost, cardWidth = TEXT_POST_CARD_WIDTH): number {
    const charsPerLine = Math.max(18, Math.floor(cardWidth / 7));
    const lineCount = Math.min(6, Math.max(1, Math.ceil(post.text.length / charsPerLine)));
    return 112 + lineCount * 20;
}

type NetworkPostColumn = {
    posts: FlipTextPost[];
    height: number;
};

/** Pack text posts into vertical columns (shortest-column-first) within max height. */
function packNetworkPostsIntoColumns(
    posts: FlipTextPost[],
    maxHeight: number,
    cardWidth = TEXT_POST_CARD_WIDTH,
): NetworkPostColumn[] {
    if (posts.length === 0) return [];

    const columns: NetworkPostColumn[] = [{ posts: [], height: 0 }];

    for (const post of posts) {
        const cardHeight = estimateTextPostCardHeight(post, cardWidth);
        let bestIdx = -1;
        let bestHeight = Number.POSITIVE_INFINITY;

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const gap = column.posts.length > 0 ? TEXT_POST_CARD_GAP : 0;
            const nextHeight = column.height + gap + cardHeight;
            if (nextHeight <= maxHeight && column.height < bestHeight) {
                bestIdx = i;
                bestHeight = column.height;
            }
        }

        if (bestIdx >= 0) {
            const column = columns[bestIdx];
            const gap = column.posts.length > 0 ? TEXT_POST_CARD_GAP : 0;
            column.posts.push(post);
            column.height += gap + cardHeight;
        } else {
            columns.push({ posts: [post], height: cardHeight });
        }
    }

    return columns.filter((column) => column.posts.length > 0);
}

interface Tag {
    id: number;
    name: string;
    count: number;
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

const isValidTextPost = (post: FlipTextPost | null | undefined): post is FlipTextPost => {
    return !!(post?.id && post?.account?.id && post?.text?.trim());
};

function SectionSkeleton({ height = 120 }: { height?: number }) {
    return (
        <View style={tw`mx-4 my-3 rounded-xl bg-gray-100 dark:bg-gray-900`}>
            <View style={{ height }} />
        </View>
    );
}

function TextPostCardSkeleton({ height = 148 }: { height?: number }) {
    return (
        <View
            style={[
                tw`rounded-xl bg-gray-100 dark:bg-[#1c1c1e]`,
                { width: TEXT_POST_CARD_WIDTH, height },
            ]}
        />
    );
}

function NetworkPostsSkeleton() {
    return (
        <View style={{ maxHeight: NETWORK_POSTS_MAX_HEIGHT, overflow: 'hidden' }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={tw`px-4`}>
                <View style={{ width: TEXT_POST_CARD_WIDTH, marginRight: TEXT_POST_CARD_GAP }}>
                    <TextPostCardSkeleton height={168} />
                    <View style={{ height: TEXT_POST_CARD_GAP }} />
                    <TextPostCardSkeleton height={132} />
                </View>
                <View style={{ width: TEXT_POST_CARD_WIDTH, marginRight: TEXT_POST_CARD_GAP }}>
                    <TextPostCardSkeleton height={196} />
                </View>
            </ScrollView>
        </View>
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

const ExploreTextPostCard = memo(function ExploreTextPostCard({
    item,
    onOpenPost,
    onOpenProfile,
    onLike,
    onHashtagPress,
    onMentionPress,
}: {
    item: FlipTextPost;
    onOpenPost: (openComments?: boolean) => void;
    onOpenProfile: () => void;
    onLike: (postId: string, liked: boolean) => void;
    onHashtagPress: (tag: string) => void;
    onMentionPress: (username: string, profileId?: string | number) => void;
}) {
    const isLiked = !!item.has_liked;
    const likeCount = item.likes ?? 0;

    const handleLike = useCallback(() => {
        onLike(item.id, !isLiked);
    }, [isLiked, item.id, onLike]);

    return (
        <PressableHaptics
            onPress={() => onOpenPost(false)}
            style={[
                tw`rounded-xl bg-gray-100 dark:bg-[#1c1c1e] p-4 overflow-hidden`,
                { width: TEXT_POST_CARD_WIDTH },
            ]}>
            <Pressable onPress={onOpenProfile} style={tw`flex-row items-center mb-3`}>
                <Avatar url={item.account.avatar} width={36} onPress={onOpenProfile} />
                <View style={tw`ml-2.5 flex-1`}>
                    <Text
                        style={tw`text-black font-semibold text-sm dark:text-white`}
                        numberOfLines={1}>
                        {item.account.name || item.account.username}
                    </Text>
                    <Text style={tw`text-gray-500 text-xs dark:text-gray-400`} numberOfLines={1}>
                        @{item.account.username} · {timeAgo(item.created_at)}
                    </Text>
                </View>
            </Pressable>

            <LinkifiedCaption
                caption={item.text}
                tags={item.tags}
                mentions={item.mentions}
                style={tw`text-gray-900 text-sm leading-5 dark:text-gray-100`}
                numberOfLines={6}
                onHashtagPress={onHashtagPress}
                onMentionPress={onMentionPress}
            />

            <View style={tw`flex-row items-center gap-4 mt-3`}>
                <PressableHaptics
                    onPress={handleLike}
                    style={tw`flex-row items-center gap-1`}
                    hitSlop={8}>
                    <Feather
                        name="heart"
                        size={13}
                        color={isLiked ? '#EF4444' : '#9CA3AF'}
                    />
                    <Text style={tw`text-gray-500 text-xs dark:text-gray-400`}>
                        {likeCount.toLocaleString()}
                    </Text>
                </PressableHaptics>
                <PressableHaptics
                    onPress={() => onOpenPost(true)}
                    style={tw`flex-row items-center gap-1`}
                    hitSlop={8}>
                    <Feather name="message-circle" size={13} color="#9CA3AF" />
                    <Text style={tw`text-gray-500 text-xs dark:text-gray-400`}>
                        {item.comments.toLocaleString()}
                    </Text>
                </PressableHaptics>
            </View>
        </PressableHaptics>
    );
});

const ExploreTagChip = memo(function ExploreTagChip({
    item,
    isSelected,
    onSelect,
}: {
    item: Tag;
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <PressableHaptics
            style={[
                tw`mr-2.5 rounded-xl px-4 py-2.5`,
                isSelected ? tw`bg-[#22D3EE]` : tw`bg-gray-100 dark:bg-gray-900`,
            ]}
            onPress={onSelect}>
            <View style={tw`w-[${TAG_CARD_WIDTH}px] items-center`}>
                <Text
                    style={[
                        tw`font-bold text-base mb-0.5`,
                        isSelected ? tw`text-white` : tw`text-black dark:text-gray-400`,
                    ]}>
                    #{item.name}
                </Text>
                {item.count > 0 ? (
                    <Text
                        style={[
                            tw`text-xs`,
                            isSelected ? tw`text-gray-200` : tw`text-gray-600`,
                        ]}>
                        {item.count.toLocaleString()} videos
                    </Text>
                ) : null}
            </View>
        </PressableHaptics>
    );
});

const ExploreVideoThumbnail = memo(function ExploreVideoThumbnail({
    item,
    index,
    onPress,
}: {
    item: Video;
    index: number;
    onPress: () => void;
}) {
    if (!item.account || !item.media) return null;

    const duration = item.media.duration || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);

    return (
        <TouchableOpacity style={tw`mb-1 px-0.5`} onPress={onPress}>
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
                {item.caption ? (
                    <View style={tw`absolute bottom-2 left-2 right-2`}>
                        <Text style={tw`text-white text-xs font-medium`} numberOfLines={2}>
                            {item.caption}
                        </Text>
                    </View>
                ) : null}
                <View style={tw`absolute top-2 right-2 bg-black bg-opacity-70 rounded px-1.5 py-0.5`}>
                    <Text style={tw`text-white text-xs`}>
                        {minutes}:{seconds.toString().padStart(2, '0')}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
});

type ExploreListHeaderProps = {
    isDark: boolean;
    showTextPostsSkeleton: boolean;
    showTagsSkeleton: boolean;
    showVideosSkeleton: boolean;
    textPosts: FlipTextPost[];
    validTags: Tag[];
    feedTag: string;
    textPostsError: boolean;
    tagsError: boolean;
    onSelectTag: (name: string) => void;
    onOpenSearch: () => void;
    onOpenProfile: (id: string) => void;
    onOpenTextPost: (post: FlipTextPost, openComments?: boolean) => void;
    onLikeTextPost: (postId: string, liked: boolean) => void;
    onHashtagPress: (tag: string) => void;
    onMentionPress: (username: string, profileId?: string | number) => void;
    renderEmptyState: (message: string) => React.ReactElement;
};

const ExploreListHeader = memo(function ExploreListHeader({
    isDark,
    showTextPostsSkeleton,
    showTagsSkeleton,
    showVideosSkeleton,
    textPosts,
    validTags,
    feedTag,
    textPostsError,
    tagsError,
    onSelectTag,
    onOpenSearch,
    onOpenProfile,
    onOpenTextPost,
    onLikeTextPost,
    onHashtagPress,
    onMentionPress,
    renderEmptyState,
}: ExploreListHeaderProps) {
    const networkPostColumns = useMemo(
        () => packNetworkPostsIntoColumns(textPosts, NETWORK_POSTS_MAX_HEIGHT),
        [textPosts],
    );

    return (
        <>
            <View style={tw`px-4 pt-4 pb-3 flex justify-between items-center flex-row`}>
                <Text style={tw`text-black text-4xl font-bold dark:text-white`}>Explore</Text>
                <Pressable onPress={onOpenSearch}>
                    <Feather name="search" color={isDark ? '#fff' : '#000'} size={30} />
                </Pressable>
            </View>

            <View style={tw`mt-5 mb-4`}>
                <Text style={tw`text-black text-lg font-bold px-4 mb-3 dark:text-gray-500`}>
                    From the network
                </Text>
                {showTextPostsSkeleton ? (
                    <NetworkPostsSkeleton />
                ) : textPosts.length > 0 ? (
                    <View style={{ maxHeight: NETWORK_POSTS_MAX_HEIGHT, overflow: 'hidden' }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={tw`px-4`}>
                            {networkPostColumns.map((column, columnIndex) => (
                                <View
                                    key={`network-col-${columnIndex}`}
                                    style={{
                                        width: TEXT_POST_CARD_WIDTH,
                                        marginRight: TEXT_POST_CARD_GAP,
                                    }}>
                                    {column.posts.map((item, itemIndex) => (
                                        <View
                                            key={item.id}
                                            style={
                                                itemIndex > 0
                                                    ? { marginTop: TEXT_POST_CARD_GAP }
                                                    : undefined
                                            }>
                                            <ExploreTextPostCard
                                                item={item}
                                                onOpenPost={(openComments) =>
                                                    onOpenTextPost(item, openComments)
                                                }
                                                onOpenProfile={() =>
                                                    onOpenProfile(item.account.id)
                                                }
                                                onLike={onLikeTextPost}
                                                onHashtagPress={onHashtagPress}
                                                onMentionPress={onMentionPress}
                                            />
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : textPostsError ? (
                    renderEmptyState('Unable to load text posts. Pull down to refresh.')
                ) : null}
            </View>

            <View style={tw`mb-4`}>
                <Text style={tw`text-black text-lg font-bold px-4 mb-3 dark:text-gray-500`}>
                    Trending
                </Text>
                {showTagsSkeleton ? (
                    <SectionSkeleton height={52} />
                ) : validTags.length > 0 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={tw`px-4`}>
                        {validTags.map((item) => (
                            <ExploreTagChip
                                key={item.id}
                                item={item}
                                isSelected={feedTag === item.name}
                                onSelect={() => onSelectTag(item.name)}
                            />
                        ))}
                    </ScrollView>
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
    );
});

export default function ExploreScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
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
        data: textPostsData,
        isLoading: textPostsLoading,
        isError: textPostsError,
        refetch: refetchTextPosts,
        isRefetching: textPostsRefetching,
    } = useInfiniteQuery({
        queryKey: ['explore', 'text-posts'],
        queryFn: getExploreTextPosts,
        getNextPageParam: (lastPage) => lastPage?.meta?.next_cursor,
        initialPageParam: null,
        placeholderData: () => {
            const cached = readExploreTextPostsCache();
            if (!cached) return undefined;
            return { pages: cached.pages, pageParams: cached.pageParams };
        },
        retry: 2,
        ...exploreQueryOptions,
    });

    const validTags = useMemo(() => {
        if (!Array.isArray(tagsData)) return [];
        return tagsData.filter(isValidTag);
    }, [tagsData]);

    const textPosts = useMemo(() => {
        if (!textPostsData?.pages) return [];
        return textPostsData.pages
            .flatMap((page) => page?.data || [])
            .filter(isValidTextPost);
    }, [textPostsData]);

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

    const allVideos = useMemo(() => {
        if (!videosData?.pages) return [];
        return videosData.pages.flatMap((page) => page?.data || []).filter(isValidVideo);
    }, [videosData]);

    React.useEffect(() => {
        if (!videosData?.pages?.length) return;
        const pages = videosData.pages;
        const pageParams = videosData.pageParams;
        const tag = feedTag;
        queueMicrotask(() => writeExploreFeedCache(tag, pages, pageParams));
    }, [feedTag, videosData]);

    React.useEffect(() => {
        if (!textPostsData?.pages?.length) return;
        const pages = textPostsData.pages;
        const pageParams = textPostsData.pageParams;
        queueMicrotask(() => writeExploreTextPostsCache(pages, pageParams));
    }, [textPostsData]);

    React.useEffect(() => {
        if (allVideos.length === 0) return;
        prefetchThumbnails(allVideos.map((video) => video.media?.thumbnail));
    }, [allVideos]);

    const renderEmptyState = useCallback(
        (message: string) => (
            <View style={tw`py-10 items-center px-4`}>
                <Text style={tw`text-gray-500 dark:text-gray-400 text-center`}>{message}</Text>
            </View>
        ),
        [],
    );

    const handleSelectTag = useCallback((name: string) => {
        setSelectedTag(name);
    }, []);

    const handleOpenSearch = useCallback(() => {
        router.push('/private/search');
    }, [router]);

    const handleOpenProfile = useCallback(
        (id: string) => {
            router.push(toProfilePath(id));
        },
        [router],
    );

    const handleOpenTextPost = useCallback(
        (post: FlipTextPost, openComments = false) => {
            router.push(toPostViewPath(post.id, { openComments }));
        },
        [router],
    );

    const textPostLikeMutation = useMutation({
        mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
            return liked ? videoLike(postId) : videoUnlike(postId);
        },
        onMutate: ({ postId, liked }) => {
            patchExploreTextPostLike(queryClient, postId, liked);
        },
        onError: (_error, { postId, liked }) => {
            patchExploreTextPostLike(queryClient, postId, !liked);
        },
        onSuccess: (result, { postId }) => {
            if (result) {
                patchExploreTextPostLike(queryClient, postId, result.has_liked, result.likes);
            }
        },
    });

    const handleLikeTextPost = useCallback(
        (postId: string, liked: boolean) => {
            textPostLikeMutation.mutate({ postId, liked });
        },
        [textPostLikeMutation],
    );

    const handleHashtagPress = useCallback(
        (tag: string) => {
            router.push(`/private/search?query=${encodeURIComponent(tag)}`);
        },
        [router],
    );

    const handleMentionPress = useCallback(
        (username: string, profileId?: string | number) => {
            const target = profileId ?? username;
            if (target) router.push(toProfilePath(String(target)));
        },
        [router],
    );

    const renderVideoThumbnail = useCallback(
        ({ item, index }: { item: Video; index: number }) => (
            <ExploreVideoThumbnail
                item={item}
                index={index}
                onPress={() => router.push(toPostViewPath(item.id))}
            />
        ),
        [router],
    );

    const showTextPostsSkeleton = textPostsLoading && textPosts.length === 0;
    const showTagsSkeleton = tagsLoading && validTags.length === 0;
    const showVideosSkeleton = videosLoading && allVideos.length === 0;

    const listHeaderElement = useMemo(
        () => (
            <ExploreListHeader
                isDark={isDark}
                showTextPostsSkeleton={showTextPostsSkeleton}
                showTagsSkeleton={showTagsSkeleton}
                showVideosSkeleton={showVideosSkeleton}
                textPosts={textPosts}
                validTags={validTags}
                feedTag={feedTag}
                textPostsError={textPostsError}
                tagsError={tagsError}
                onSelectTag={handleSelectTag}
                onOpenSearch={handleOpenSearch}
                onOpenProfile={handleOpenProfile}
                onOpenTextPost={handleOpenTextPost}
                onLikeTextPost={handleLikeTextPost}
                onHashtagPress={handleHashtagPress}
                onMentionPress={handleMentionPress}
                renderEmptyState={renderEmptyState}
            />
        ),
        [
            feedTag,
            handleHashtagPress,
            handleMentionPress,
            handleOpenProfile,
            handleOpenSearch,
            handleOpenTextPost,
            handleLikeTextPost,
            handleSelectTag,
            isDark,
            renderEmptyState,
            showTagsSkeleton,
            showTextPostsSkeleton,
            showVideosSkeleton,
            tagsError,
            textPosts,
            textPostsError,
            validTags,
        ],
    );

    const showEmptyExplore =
        !showTextPostsSkeleton &&
        !showTagsSkeleton &&
        !showVideosSkeleton &&
        validTags.length === 0 &&
        textPosts.length === 0 &&
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
        void refetchTextPosts();
        void refetchVideos();
    }, [refetchTags, refetchTextPosts, refetchVideos]);

    const isRefreshing = tagsRefetching || textPostsRefetching || videosRefetching;

    return (
        <SafeAreaView edges={['top']} style={tw`flex-1 bg-white dark:bg-black`}>
            <FlatList
                data={allVideos}
                numColumns={3}
                keyExtractor={(item) => item.id}
                renderItem={renderVideoThumbnail}
                ListHeaderComponent={listHeaderElement}
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
