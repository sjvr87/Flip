import { LOOP_ACCENT } from '@/constants/loopsPalette';
import FeedActionRail from '@/components/feed/FeedActionRail';
import LinkifiedCaption from '@/components/feed/LinkifiedCaption';
import { toProfilePath } from '@/utils/profileNavigation';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function safeCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export default function PhotoFeedSlide({
    item,
    onLike,
    onComment,
    onShare,
    onBookmark,
    onRepost,
    onOther,
    bottomInset,
    tabBarHeight = 20,
    onNavigate,
}) {
    const router = useRouter();
    const [isLiked, setIsLiked] = useState(item.has_liked);
    const [isBookmarked, setIsBookmarked] = useState(item.has_bookmarked);
    const [isReposted, setIsReposted] = useState(!!item.has_reposted);

    const likeCount = safeCount(item.likes) + (isLiked && !item.has_liked ? 1 : 0);
    const bookmarkCount =
        safeCount(item.bookmarks) + (isBookmarked && !item.has_bookmarked ? 1 : 0);
    const repostCount =
        safeCount(item.shares) +
        (isReposted && !item.has_reposted ? 1 : 0) -
        (!isReposted && item.has_reposted ? 1 : 0);

    const handleLike = () => {
        setIsLiked(!isLiked);
        onLike(item.id, !isLiked);
    };

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
        onBookmark(item.id, !isBookmarked);
    };

    const handleRepost = () => {
        setIsReposted(!isReposted);
        onRepost?.(item.id, !isReposted);
    };

    return (
        <View style={styles.container}>
            <Image
                source={{ uri: item.media.src_url || item.media.thumbnail }}
                style={styles.image}
                contentFit="contain"
                accessible
                accessibilityLabel={item.caption || 'Photo'}
            />

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
                style={styles.gradientOverlay}
                pointerEvents="none"
            />

            <FeedActionRail
                avatarUrl={item.account?.avatar}
                profileLabel={`View ${item.account.username}'s profile`}
                isLiked={isLiked}
                isBookmarked={isBookmarked}
                isReposted={isReposted}
                likeCount={likeCount}
                commentCount={safeCount(item.comments)}
                bookmarkCount={bookmarkCount}
                repostCount={repostCount}
                canComment={item.permissions?.can_comment !== false}
                bottomInset={bottomInset}
                tabBarHeight={tabBarHeight}
                onProfilePress={() => router.push(toProfilePath(item.account.id))}
                onLike={handleLike}
                onComment={() => onComment(item)}
                onBookmark={handleBookmark}
                onRepost={handleRepost}
                onShare={() => onShare(item)}
                onOther={() => onOther(item)}
            />

            <View style={[styles.bottomInfo, { bottom: bottomInset + tabBarHeight + 10 }]}>
                <TouchableOpacity
                    onPress={() => {
                        onNavigate?.();
                        router.push(toProfilePath(item.account.id));
                    }}>
                    <Text style={styles.username}>@{item.account.username}</Text>
                </TouchableOpacity>
                {item.caption ? (
                    <LinkifiedCaption
                        caption={item.caption}
                        tags={item.tags || []}
                        mentions={item.mentions || []}
                        style={styles.caption}
                        numberOfLines={2}
                        onHashtagPress={(tag) => {
                            onNavigate?.();
                            router.push(`/private/search?query=${tag}`);
                        }}
                        onMentionPress={(username, profileId) => {
                            onNavigate?.();
                            const target = profileId ?? username;
                            if (!target) return;
                            router.push(toProfilePath(target));
                        }}
                        onMorePress={() => onComment(item)}
                    />
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    image: {
        flex: 1,
        width: '100%',
    },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '40%',
    },
    bottomInfo: {
        position: 'absolute',
        left: 12,
        right: 80,
    },
    username: {
        color: LOOP_ACCENT,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    caption: {
        color: 'white',
        fontSize: 14,
    },
});
