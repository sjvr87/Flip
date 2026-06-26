import FoldedHeartIcon, { FOLDED_HEART_ACTIVITY_SIZE } from '@/components/icons/FoldedHeartIcon';
import MegaphoneCommentIcon, {
    MEGAPHONE_COMMENT_ACTIVITY_SIZE,
} from '@/components/icons/MegaphoneCommentIcon';
import Avatar from '@/components/Avatar';
import MentionText from '@/components/MentionText';
import { useTheme } from '@/contexts/ThemeContext';
import { AVATAR_SIZE } from '@/utils/avatarShape';
import { timeAgo } from '@/utils/ui';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import tw from 'twrnc';

interface Actor {
    id: string;
    name: string;
    username: string;
    avatar: string;
}

interface NotificationItemProps {
    item: {
        id: string;
        type: string;
        video_pid?: string;
        video_id?: string;
        video_thumbnail?: string;
        actor: Actor;
        url?: string;
        read_at: string | null;
        created_at: string;
    };
    onPress: (item: any) => void;
    onProfilePress: (actor: Actor, item: any) => void;
}

const DEFAULT_ACTIVITY_BADGE_OFFSET: ViewStyle = { bottom: -2, right: -2 };
/** Comment megaphone reads smaller in the viewBox — sit lower/right so it clears the avatar. */
const COMMENT_ACTIVITY_BADGE_OFFSET: ViewStyle = { bottom: -8, right: -10 };

function isCommentActivityType(type: string): boolean {
    return type === 'video.comment' || type === 'video.commentReply';
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
    item,
    onPress,
    onProfilePress,
}) => {
    const isUnread = item.read_at === null;
    const { isDark } = useTheme();
    const activityIconColor = isDark ? '#FFFFFF' : '#1A1A1A';

    const getNotificationText = () => {
        switch (item.type) {
            case 'video.like':
                return 'liked your video.';
            case 'new_follower':
                return item.kit?.path ? `followed you from a Starter Kit.` : 'followed you.';
            case 'video.commentReply':
                return 'replied to your comment.';
            case 'video.comment':
                return 'commented on your video.';
            case 'profile.view':
                return 'viewed your profile.';
            case 'video.share':
                return 'shared your video.';
            case 'comment.like':
                return 'liked your comment.';
            case 'comment.share':
                return 'shared your comment.';
            case 'commentReply.like':
                return 'liked your reply.';
            case 'commentReply.share':
                return 'shared your reply.';
            case 'video.duet':
                return 'dueted your video.';
            case 'starterKit.awaitingApproval':
                return 'wants to add you to a Starter Kit';
            case 'starterKit.accountApproved':
                return 'accepted to be included in your Starter Kit';
            case 'starterKit.newMember':
                return 'added a new member to a Starter Kit';
            case 'starterKit.accountRejected':
                return 'declined to be included in your Starter Kit';
            case 'starterKit.removedFromKit':
                return 'removed you from a Starter Kit';
            default:
                return 'interacted with your content.';
        }
    };

    const getBadgeIcon = () => {
        switch (item.type) {
            case 'new_follower':
                return <Ionicons name="person-add" size={16} color="#007AFF" />;
            case 'video.like':
            case 'comment.like':
            case 'commentReply.like':
                return <FoldedHeartIcon size={FOLDED_HEART_ACTIVITY_SIZE} variant="filled" />;
            case 'video.commentReply':
            case 'video.comment':
                return (
                    <MegaphoneCommentIcon
                        size={MEGAPHONE_COMMENT_ACTIVITY_SIZE}
                        color={activityIconColor}
                    />
                );
            case 'comment.share':
            case 'commentReply.share':
            case 'video.share':
                return <Ionicons name="sync" size={16} color="#FF2D55" />;
            case 'starterKit.accountApproved':
            case 'starterKit.newMember':
            case 'starterKit.removedFromKit':
            case 'starterKit.awaitingApproval':
            case 'starterKit.accountApproved':
            case 'starterKit.accountRejected':
                return <Ionicons name="sparkles" size={16} color="#8B5CF6" />;
            default:
                return null;
        }
    };

    const badgeIcon = getBadgeIcon();
    const badgeOffset = useMemo(
        () =>
            isCommentActivityType(item.type)
                ? COMMENT_ACTIVITY_BADGE_OFFSET
                : DEFAULT_ACTIVITY_BADGE_OFFSET,
        [item.type],
    );

    const showActionButtons = false;

    return (
        <View
            style={[
                tw`flex-row items-center py-3 px-4 border-b border-[#E5E5E5] dark:border-gray-900`,
            ]}>
            {isUnread && <View style={tw`w-2 h-2 rounded-full bg-red-500 mr-2 mt-1.5`} />}

            <Pressable onPress={() => onProfilePress(item.actor, item)} style={tw`relative mr-3`}>
                <Avatar url={item.actor.avatar} width={AVATAR_SIZE.row} />
                {badgeIcon ? (
                    <View style={[tw`absolute`, badgeOffset]}>{badgeIcon}</View>
                ) : null}
            </Pressable>

            <Pressable onPress={() => onPress(item)} style={tw`flex-1 flex-row items-center`}>
                <View style={tw`flex-1 mr-2`}>
                    <Text style={tw`text-base`}>
                        <MentionText
                            username={item.actor.username}
                            style={tw`font-semibold text-base`}
                        />
                        <Text style={tw`text-gray-700 dark:text-gray-300`}>
                            {' '}
                            {getNotificationText()}
                        </Text>
                    </Text>

                    <Text style={tw`text-gray-500 text-sm mt-0.5`}>{timeAgo(item.created_at)}</Text>

                    {showActionButtons && (
                        <View style={tw`flex-row mt-2 gap-4`}>
                            <Pressable style={tw`flex-row items-center gap-1`}>
                                <Ionicons name="chatbubble-outline" size={18} color="#666" />
                                <Text style={tw`text-gray-600`}>Reply</Text>
                            </Pressable>
                            <Pressable style={tw`flex-row items-center gap-1`}>
                                <Ionicons name="heart-outline" size={18} color="#666" />
                                <Text style={tw`text-gray-600`}>Like</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {item.video_thumbnail && (
                    <Image
                        source={{ uri: item.video_thumbnail }}
                        style={tw`w-14 h-14 rounded-lg`}
                    />
                )}

                <Ionicons name="chevron-forward" size={20} color="#999" style={tw`ml-2`} />
            </Pressable>
        </View>
    );
};
