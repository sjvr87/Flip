import Avatar from '@/components/Avatar';
import FoldedHeartIcon, { FOLDED_HEART_DESIGN_SIZE } from '@/components/icons/FoldedHeartIcon';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps, memo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICON_SIZE = 30;
const LIKE_ICON_SIZE = FOLDED_HEART_DESIGN_SIZE;
const ICON_COLOR = '#FFFFFF';
const MIN_TOUCH = 48;

type FeedActionRailProps = {
    avatarUrl?: string | null;
    profileLabel: string;
    isLiked: boolean;
    isBookmarked: boolean;
    isReposted: boolean;
    isMuted: boolean;
    likeCount: number;
    commentCount: number;
    bookmarkCount: number;
    repostCount: number;
    canComment?: boolean;
    canUseAudio?: boolean;
    bottomInset: number;
    tabBarHeight?: number;
    /** When set, overrides bottomInset + tabBarHeight (Good Lock–aware total). */
    overlayBottom?: number;
    onProfilePress: () => void;
    onLike: () => void;
    onComment: () => void;
    onBookmark: () => void;
    onRepost: () => void;
    onShare: () => void;
    onMuteToggle: () => void;
    onUseAudio?: () => void;
    onOther: () => void;
};

function FeedActionIcon({
    name,
    activeName,
    active,
    color = ICON_COLOR,
    activeColor = LOOP_ACCENT,
}: {
    name: IoniconName;
    activeName?: IoniconName;
    active?: boolean;
    color?: string;
    activeColor?: string;
}) {
    const iconName = active && activeName ? activeName : name;
    const iconColor = active ? activeColor : color;

    return (
        <View style={styles.iconShadow}>
            <Ionicons name={iconName} size={ICON_SIZE} color={iconColor} />
        </View>
    );
}

function LikeActionIcon({ active }: { active: boolean }) {
    return (
        <View style={styles.iconShadow}>
            <FoldedHeartIcon
                size={LIKE_ICON_SIZE}
                variant={active ? 'filled' : 'outline'}
            />
        </View>
    );
}

function FeedActionRail({
    avatarUrl,
    profileLabel,
    isLiked,
    isBookmarked,
    isReposted,
    isMuted,
    likeCount,
    commentCount,
    bookmarkCount,
    repostCount,
    canComment = true,
    canUseAudio = false,
    bottomInset,
    tabBarHeight = 20,
    overlayBottom,
    onProfilePress,
    onLike,
    onComment,
    onBookmark,
    onRepost,
    onShare,
    onMuteToggle,
    onUseAudio,
    onOther,
}: FeedActionRailProps) {
    const railBottom = overlayBottom ?? bottomInset + tabBarHeight + 20;

    return (
        <View style={[styles.rightActions, { bottom: railBottom }]}>
            <PressableHaptics
                style={styles.actionButton}
                onPress={onProfilePress}
                accessible
                accessibilityLabel={profileLabel}
                accessibilityRole="button">
                <LinearGradient
                    colors={['#22D3EE', '#06B6D4', '#0891B2']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.avatarRing}>
                    <View style={styles.avatarInner}>
                        <Avatar
                            url={avatarUrl}
                            width={40}
                            borderWidth={0}
                            placeholder={{ color: '#3a3a3a' }}
                            transition={0}
                            cachePolicy="memory-disk"
                        />
                    </View>
                </LinearGradient>
            </PressableHaptics>

            <PressableHaptics
                style={styles.actionButton}
                onPress={onLike}
                accessible
                accessibilityLabel={
                    isLiked ? `Unlike. ${likeCount} likes` : `Like. ${likeCount} likes`
                }
                accessibilityRole="button"
                accessibilityState={{ selected: isLiked }}>
                <LikeActionIcon active={isLiked} />
                <Text style={styles.actionText} accessibilityElementsHidden>
                    {likeCount}
                </Text>
            </PressableHaptics>

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onComment}
                accessible
                accessibilityLabel={
                    canComment
                        ? `Comments. ${commentCount} comments`
                        : 'Comments are disabled'
                }
                accessibilityRole="button">
                <FeedActionIcon name="chatbubble-ellipses-outline" />
                {canComment && (
                    <Text style={styles.actionText} accessibilityElementsHidden>
                        {commentCount}
                    </Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onBookmark}
                accessible
                accessibilityLabel={
                    isBookmarked
                        ? `Remove bookmark. ${bookmarkCount} bookmarks`
                        : `Bookmark. ${bookmarkCount} bookmarks`
                }
                accessibilityRole="button"
                accessibilityState={{ selected: isBookmarked }}>
                <FeedActionIcon
                    name="bookmark-outline"
                    activeName="bookmark"
                    active={isBookmarked}
                />
                <Text style={styles.actionText} accessibilityElementsHidden>
                    {bookmarkCount}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onRepost}
                accessible
                accessibilityLabel={
                    isReposted
                        ? `Undo repost. ${repostCount} reposts`
                        : `Repost. ${repostCount} reposts`
                }
                accessibilityRole="button"
                accessibilityState={{ selected: isReposted }}>
                <FeedActionIcon
                    name="repeat-outline"
                    activeName="repeat"
                    active={isReposted}
                />
                <Text style={styles.actionText} accessibilityElementsHidden>
                    {repostCount}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onShare}
                accessible
                accessibilityLabel="Share video"
                accessibilityRole="button">
                <FeedActionIcon name="arrow-redo-outline" />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onMuteToggle}
                accessible
                accessibilityLabel={isMuted ? 'Unmute feed videos' : 'Mute feed videos'}
                accessibilityRole="button"
                accessibilityState={{ selected: isMuted }}>
                <FeedActionIcon
                    name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                    active={isMuted}
                />
            </TouchableOpacity>

            {canUseAudio && onUseAudio ? (
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onUseAudio}
                    accessible
                    accessibilityLabel="Use this audio"
                    accessibilityRole="button">
                    <FeedActionIcon name="musical-notes-outline" />
                </TouchableOpacity>
            ) : null}

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onOther}
                accessible
                accessibilityLabel="More options"
                accessibilityRole="button">
                <FeedActionIcon name="ellipsis-horizontal" />
            </TouchableOpacity>
        </View>
    );
}

export default memo(FeedActionRail);

const styles = StyleSheet.create({
    rightActions: {
        position: 'absolute',
        right: 10,
        alignItems: 'center',
        gap: 4,
        zIndex: 5,
        elevation: 5,
    },
    actionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: MIN_TOUCH,
        minHeight: MIN_TOUCH,
        paddingVertical: 4,
    },
    iconShadow: {
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.45,
                shadowRadius: 3,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    actionText: {
        color: ICON_COLOR,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.5,
                shadowRadius: 2,
            },
            android: {
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
            },
        }),
    },
    avatarRing: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.35,
                shadowRadius: 4,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    avatarInner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#3a3a3a',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});
