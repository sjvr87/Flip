import MentionText from '@/components/MentionText';
import FeedActionRail from '@/components/feed/FeedActionRail';
import LinkifiedCaption from '@/components/feed/LinkifiedCaption';
import type { FlipTextPost } from '@/atproto/types';
import { toProfilePath } from '@/utils/profileNavigation';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

type TextPostSlideProps = {
    item: FlipTextPost;
    bottomInset: number;
    tabBarHeight?: number;
    onLike: (postId: string, liked: boolean) => void;
    onComment: (item: FlipTextPost) => void;
    onShare: (item: FlipTextPost) => void;
    onBookmark?: (postId: string, bookmarked: boolean) => void;
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
    onNavigate,
}: TextPostSlideProps) {
    const router = useRouter();

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
                isLiked={false}
                isBookmarked={false}
                isReposted={false}
                isMuted={false}
                likeCount={item.likes}
                commentCount={item.comments}
                bookmarkCount={0}
                repostCount={item.reposts}
                canComment
                canUseAudio={false}
                bottomInset={bottomInset}
                tabBarHeight={tabBarHeight}
                onProfilePress={() => {
                    onNavigate?.();
                    router.push(toProfilePath(item.account.id));
                }}
                onLike={() => onLike(item.id, true)}
                onComment={() => onComment(item)}
                onBookmark={() => onBookmark?.(item.id, true)}
                onRepost={() => {}}
                onShare={() => onShare(item)}
                onMuteToggle={() => {}}
                onOther={() => onComment(item)}
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
