import MentionText from '@/components/MentionText';
import FeedActionRail from '@/components/feed/FeedActionRail';
import LinkifiedCaption from '@/components/feed/LinkifiedCaption';
import type { FlipTextPost } from '@/atproto/types';
import { toProfilePath } from '@/utils/profileNavigation';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

function safeCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

type TextPostSlideProps = {
    item: FlipTextPost;
    bottomInset: number;
    tabBarHeight?: number;
    onLike: (postId: string, liked: boolean) => void;
    onComment: (item: FlipTextPost) => void;
    onShare: (item: FlipTextPost) => void;
    onBookmark?: (postId: string, bookmarked: boolean) => void;
    onRepost?: (postId: string, reposted: boolean) => void;
    onOther?: (item: FlipTextPost) => void;
    onNavigate?: () => void;
};

export default function TextPostSlide({
    item,
    bottomInset,
    tabBarHeight = 20,
    onLike,
    onComment,
    onShare,
    onBookmark,
    onRepost,
    onOther,
    onNavigate,
}: TextPostSlideProps) {
    const router = useRouter();
    const [isLiked, setIsLiked] = useState(!!item.has_liked);
    const [isBookmarked, setIsBookmarked] = useState(!!item.has_bookmarked);
    const [isReposted, setIsReposted] = useState(!!item.has_reposted);

    const likeCount =
        safeCount(item.likes) +
        (isLiked && !item.has_liked ? 1 : 0) -
        (!isLiked && item.has_liked ? 1 : 0);
    const bookmarkCount =
        safeCount(item.bookmarks) +
        (isBookmarked && !item.has_bookmarked ? 1 : 0) -
        (!isBookmarked && item.has_bookmarked ? 1 : 0);
    const repostCount =
        safeCount(item.reposts) +
        (isReposted && !item.has_reposted ? 1 : 0) -
        (!isReposted && item.has_reposted ? 1 : 0);

    const handleLike = () => {
        setIsLiked(!isLiked);
        onLike(item.id, !isLiked);
    };

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
        onBookmark?.(item.id, !isBookmarked);
    };

    const handleRepost = () => {
        setIsReposted(!isReposted);
        onRepost?.(item.id, !isReposted);
    };

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: bottomInset + tabBarHeight + 120 },
                ]}
                showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    onPress={() => {
                        onNavigate?.();
                        router.push(toProfilePath(item.account.id));
                    }}>
                    <MentionText username={item.account.username} style={styles.username} />
                </TouchableOpacity>

                <LinkifiedCaption
                    caption={item.text}
                    tags={item.tags}
                    mentions={item.mentions}
                    style={styles.body}
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
                />
            </ScrollView>

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.8)']}
                style={[styles.gradientOverlay, { bottom: bottomInset + tabBarHeight }]}
                pointerEvents="none"
            />

            <FeedActionRail
                avatarUrl={item.account.avatar}
                profileLabel={`View ${item.account.username}'s profile`}
                isLiked={isLiked}
                isBookmarked={isBookmarked}
                isReposted={isReposted}
                likeCount={likeCount}
                commentCount={item.comments}
                bookmarkCount={bookmarkCount}
                repostCount={repostCount}
                canComment
                canUseAudio={false}
                showMuteControl={false}
                bottomInset={bottomInset}
                tabBarHeight={tabBarHeight}
                onProfilePress={() => {
                    onNavigate?.();
                    router.push(toProfilePath(item.account.id));
                }}
                onLike={handleLike}
                onComment={() => onComment(item)}
                onBookmark={handleBookmark}
                onRepost={handleRepost}
                onShare={() => onShare(item)}
                isMuted={false}
                onMuteToggle={() => {}}
                onOther={() => (onOther ? onOther(item) : onComment(item))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 72,
    },
    username: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
    },
    body: {
        color: '#fff',
        fontSize: 18,
        lineHeight: 28,
    },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: '28%',
    },
});
