import Avatar from '@/components/Avatar';
import FoldedHeartIcon from '@/components/icons/FoldedHeartIcon';
import RepostArrowIcon from '@/components/icons/RepostArrowIcon';
import FollowAddBadgeIcon from '@/components/icons/FollowAddBadgeIcon';
import MegaphoneCommentIcon from '@/components/icons/MegaphoneCommentIcon';
import RemixVinylIcon from '@/components/icons/RemixVinylIcon';
import SpeakerSoundIcon from '@/components/icons/SpeakerSoundIcon';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { FOLLOWING_DIDS_QUERY_KEY, useFollowingDids } from '@/hooks/useFollowingDids';
import { addAccountToFollowingCache, appendAccountToFollowingSet, followAccount } from '@/atproto';
import { useAuthStore } from '@/utils/authStore';
import { ensureQueueMicrotask, safeQueueMicrotask } from '@/utils/safeQueueMicrotask';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps, memo, ReactNode } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Uniform slot — Ionicons + custom SVGs share this hit area. */
const ICON_SLOT = 30;
/** Feed avatar — squircle, slightly larger than prior 40px circle-in-48px ring. */
const AVATAR_SIZE = 48;
const AVATAR_RADIUS = 14;
const AVATAR_INNER = AVATAR_SIZE + 6;
const AVATAR_RING = AVATAR_INNER + 4;
const FOLLOW_BADGE_SIZE = 28;
const ICON_COLOR = '#FFFFFF';
const MIN_TOUCH = 48;
/** Reserved below every icon so counts don't shift icon vertical position. */
const COUNT_FONT_SIZE = 12;
const COUNT_LINE_HEIGHT = 16;

/** Optical boost within ICON_SLOT — artwork that under-fills its viewBox. */
const OPTICAL = {
    ionicon: 1,
    speaker: 1.14,
    heart: 1,
    repost: 1,
    remix: 1,
    comment: 1.17,
} as const;
/** Megaphone figure + waves read left-heavy in viewBox — nudge to rail centerline. */
const COMMENT_ICON_OFFSET_X = 5;

type FeedActionRailProps = {
    avatarUrl?: string | null;
    profileLabel: string;
    creatorId?: string;
    creatorUsername?: string;
    isOwnPost?: boolean;
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
    /** When false, hides feed mute/unmute (e.g. text-only posts with no audio). */
    showMuteControl?: boolean;
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

function ActionIconSlot({
    children,
    opticalScale = 1,
    opticalOffsetX = 0,
}: {
    children: ReactNode;
    opticalScale?: number;
    opticalOffsetX?: number;
}) {
    const hasOptical = opticalScale !== 1 || opticalOffsetX !== 0;
    const opticalTransform = hasOptical
        ? [
              ...(opticalOffsetX !== 0 ? [{ translateX: opticalOffsetX } as const] : []),
              ...(opticalScale !== 1 ? [{ scale: opticalScale } as const] : []),
          ]
        : undefined;

    return (
        <View style={styles.iconShadow}>
            <View style={styles.iconSlot}>
                <View
                    style={
                        opticalTransform
                            ? [styles.iconSlotInner, { transform: opticalTransform }]
                            : styles.iconSlotInner
                    }>
                    {children}
                </View>
            </View>
        </View>
    );
}

function ActionCountSlot({ children }: { children?: ReactNode }) {
    return <View style={styles.countSlot}>{children}</View>;
}

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
        <ActionIconSlot opticalScale={OPTICAL.ionicon}>
            <Ionicons name={iconName} size={ICON_SLOT} color={iconColor} />
        </ActionIconSlot>
    );
}

function LikeActionIcon({ active }: { active: boolean }) {
    return (
        <ActionIconSlot opticalScale={OPTICAL.heart}>
            <FoldedHeartIcon
                size={ICON_SLOT}
                variant={active ? 'filled' : 'outline'}
                outlineColor={ICON_COLOR}
                outlineOpacity={1}
            />
        </ActionIconSlot>
    );
}

function RepostActionIcon({ active }: { active: boolean }) {
    return (
        <ActionIconSlot opticalScale={OPTICAL.repost}>
            <RepostArrowIcon size={ICON_SLOT} active={active} feedSlot />
        </ActionIconSlot>
    );
}

function MuteActionIcon({ muted }: { muted: boolean }) {
    return (
        <ActionIconSlot opticalScale={OPTICAL.speaker}>
            <SpeakerSoundIcon size={ICON_SLOT} color={muted ? LOOP_ACCENT : ICON_COLOR} />
        </ActionIconSlot>
    );
}

function RemixActionIcon() {
    return (
        <ActionIconSlot opticalScale={OPTICAL.remix}>
            <RemixVinylIcon size={ICON_SLOT} color={ICON_COLOR} />
        </ActionIconSlot>
    );
}

function CommentActionIcon() {
    return (
        <ActionIconSlot opticalScale={OPTICAL.comment} opticalOffsetX={COMMENT_ICON_OFFSET_X}>
            <MegaphoneCommentIcon size={ICON_SLOT} color={ICON_COLOR} />
        </ActionIconSlot>
    );
}

function FeedActionRail({
    avatarUrl,
    profileLabel,
    creatorId,
    creatorUsername,
    isOwnPost = false,
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
    showMuteControl = true,
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
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const { isFollowing } = useFollowingDids();
    const queryClient = useQueryClient();

    const followMutation = useMutation({
        mutationFn: async () => {
            if (!creatorId) {
                throw new Error('No creator ID');
            }
            return followAccount(creatorId);
        },
        onMutate: () => {
            if (!creatorId) {
                return {};
            }
            const account = { id: creatorId, username: creatorUsername };
            const previousFollowing =
                queryClient.getQueryData<Set<string>>(FOLLOWING_DIDS_QUERY_KEY);
            queryClient.setQueryData<Set<string>>(FOLLOWING_DIDS_QUERY_KEY, (prev) =>
                appendAccountToFollowingSet(prev, account),
            );
            addAccountToFollowingCache(account);
            return { previousFollowing };
        },
        onSuccess: () => {
            if (creatorId) {
                addAccountToFollowingCache({ id: creatorId, username: creatorUsername });
            }
        },
        onError: (_error, _variables, context) => {
            if (context?.previousFollowing !== undefined) {
                queryClient.setQueryData(FOLLOWING_DIDS_QUERY_KEY, context.previousFollowing);
            }
            safeQueueMicrotask(() => {
                Alert.alert('Error', 'Failed to follow. Please try again.');
            });
        },
    });

    const showFollowAffordance = Boolean(isLoggedIn && creatorId && !isOwnPost);
    const alreadyFollowing =
        followMutation.isPending ||
        followMutation.isSuccess ||
        isFollowing({ id: creatorId, username: creatorUsername });
    const showNotFollowing = showFollowAffordance && !alreadyFollowing;

    const handleFollowPress = () => {
        if (!showNotFollowing || followMutation.isPending) {
            return;
        }
        ensureQueueMicrotask();
        safeQueueMicrotask(() => {
            followMutation.mutate();
        });
    };

    return (
        <View style={[styles.rightActions, { bottom: railBottom }]}>
            <View style={styles.avatarStack}>
                <PressableHaptics
                    style={styles.actionButton}
                    onPress={onProfilePress}
                    accessible
                    accessibilityLabel={profileLabel}
                    accessibilityRole="button">
                    {!showFollowAffordance ? (
                        <LinearGradient
                            colors={['#22D3EE', '#06B6D4', '#0891B2']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.avatarRing}>
                            <View style={styles.avatarInner}>
                                <Avatar
                                    url={avatarUrl}
                                    width={AVATAR_SIZE}
                                    rounded={false}
                                    radius={AVATAR_RADIUS}
                                    borderWidth={0}
                                    placeholder={{ color: '#3a3a3a' }}
                                    transition={0}
                                    cachePolicy="memory-disk"
                                />
                            </View>
                        </LinearGradient>
                    ) : (
                        <View
                            style={[
                                styles.avatarRingPlain,
                                alreadyFollowing && styles.avatarRingFollowed,
                            ]}>
                            <View style={styles.avatarInner}>
                                <Avatar
                                    url={avatarUrl}
                                    width={AVATAR_SIZE}
                                    rounded={false}
                                    radius={AVATAR_RADIUS}
                                    borderWidth={0}
                                    placeholder={{ color: '#3a3a3a' }}
                                    transition={0}
                                    cachePolicy="memory-disk"
                                />
                            </View>
                        </View>
                    )}
                </PressableHaptics>

                {showNotFollowing ? (
                    <PressableHaptics
                        style={styles.followBadge}
                        onPress={handleFollowPress}
                        disabled={followMutation.isPending}
                        accessible
                        accessibilityLabel={`Follow ${creatorUsername ?? 'creator'}`}
                        accessibilityRole="button">
                        <FollowAddBadgeIcon size={FOLLOW_BADGE_SIZE} />
                    </PressableHaptics>
                ) : null}
            </View>

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
                <ActionCountSlot>
                    <Text style={styles.actionText} accessibilityElementsHidden>
                        {likeCount}
                    </Text>
                </ActionCountSlot>
            </PressableHaptics>

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onComment}
                accessible
                accessibilityLabel={
                    canComment ? `Comments. ${commentCount} comments` : 'Comments are disabled'
                }
                accessibilityRole="button">
                <CommentActionIcon />
                <ActionCountSlot>
                    {canComment ? (
                        <Text style={styles.actionText} accessibilityElementsHidden>
                            {commentCount}
                        </Text>
                    ) : null}
                </ActionCountSlot>
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
                <ActionCountSlot>
                    <Text style={styles.actionText} accessibilityElementsHidden>
                        {bookmarkCount}
                    </Text>
                </ActionCountSlot>
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
                <RepostActionIcon active={isReposted} />
                <ActionCountSlot>
                    <Text style={styles.actionText} accessibilityElementsHidden>
                        {repostCount}
                    </Text>
                </ActionCountSlot>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onShare}
                accessible
                accessibilityLabel="Share video"
                accessibilityRole="button">
                <FeedActionIcon name="arrow-redo-outline" />
                <ActionCountSlot />
            </TouchableOpacity>

            {showMuteControl ? (
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onMuteToggle}
                    accessible
                    accessibilityLabel={isMuted ? 'Unmute feed videos' : 'Mute feed videos'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isMuted }}>
                    <MuteActionIcon muted={isMuted} />
                    <ActionCountSlot />
                </TouchableOpacity>
            ) : null}

            {canUseAudio && onUseAudio ? (
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onUseAudio}
                    accessible
                    accessibilityLabel="Use audio with credit"
                    accessibilityHint="Opens camera to record a remix; audio credit is attached to your post"
                    accessibilityRole="button">
                    <RemixActionIcon />
                    <ActionCountSlot />
                </TouchableOpacity>
            ) : null}

            <TouchableOpacity
                style={styles.actionButton}
                onPress={onOther}
                accessible
                accessibilityLabel="More options"
                accessibilityRole="button">
                <FeedActionIcon name="ellipsis-horizontal" />
                <ActionCountSlot />
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
        zIndex: 12,
        elevation: 12,
    },
    actionButton: {
        alignItems: 'center',
        minWidth: MIN_TOUCH,
        minHeight: MIN_TOUCH,
        paddingTop: 1,
        paddingBottom: 1,
        overflow: 'visible',
    },
    iconSlot: {
        width: ICON_SLOT,
        height: ICON_SLOT,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    iconSlotInner: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    countSlot: {
        minHeight: COUNT_LINE_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
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
        fontSize: COUNT_FONT_SIZE,
        lineHeight: COUNT_LINE_HEIGHT,
        fontWeight: '600',
        textAlign: 'center',
        includeFontPadding: false,
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
        width: AVATAR_RING,
        height: AVATAR_RING,
        borderRadius: AVATAR_RADIUS + 2,
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
    avatarRingPlain: {
        width: AVATAR_RING,
        height: AVATAR_RING,
        borderRadius: AVATAR_RADIUS + 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    avatarRingFollowed: {
        borderColor: 'rgba(255,255,255,0.55)',
    },
    avatarStack: {
        alignItems: 'center',
        marginBottom: 2,
        overflow: 'visible',
    },
    followBadge: {
        position: 'absolute',
        right: -8,
        bottom: -14,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        elevation: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.55,
                shadowRadius: 3,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    avatarInner: {
        width: AVATAR_INNER,
        height: AVATAR_INNER,
        borderRadius: AVATAR_RADIUS + 1,
        backgroundColor: '#3a3a3a',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});
