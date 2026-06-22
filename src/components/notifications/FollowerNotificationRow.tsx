import MentionText from '@/components/MentionText';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText } from '@/components/ui/Stack';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { timeAgo } from '@/utils/ui';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import tw from 'twrnc';

interface Actor {
    id: string;
    name: string;
    username: string;
    avatar: string;
}

type Props = {
    item: {
        id: string;
        actor: Actor;
        read_at: string | null;
        created_at: string;
        kit?: { path?: string };
    };
    onPress: () => void;
    onProfilePress: () => void;
    onAccept: () => void;
    isAccepting: boolean;
    isAccepted: boolean;
};

export function FollowerNotificationRow({
    item,
    onPress,
    onProfilePress,
    onAccept,
    isAccepting,
    isAccepted,
}: Props) {
    const isUnread = item.read_at === null;
    const followText = item.kit?.path ? 'followed you from a Starter Kit.' : 'followed you.';

    return (
        <View style={tw`flex-row items-center py-3 px-4 border-b border-gray-100 dark:border-gray-900`}>
            {isUnread ? <View style={tw`w-2 h-2 rounded-full bg-red-500 mr-2`} /> : null}

            <Pressable onPress={onProfilePress} style={tw`relative mr-3`}>
                {item.actor.avatar ? (
                    <Image source={{ uri: item.actor.avatar }} style={tw`w-12 h-12 rounded-full`} />
                ) : (
                    <View
                        style={tw`w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 items-center justify-center`}>
                        <Ionicons name="person" size={22} color="#999" />
                    </View>
                )}
                <View
                    style={tw`absolute -bottom-1 -right-1 rounded-full p-1 bg-white dark:bg-gray-900`}>
                    <Ionicons name="person-add" size={14} color="#007AFF" />
                </View>
            </Pressable>

            <Pressable onPress={onPress} style={tw`flex-1 mr-2`}>
                <Text style={tw`text-base`}>
                    <MentionText username={item.actor.username} style={tw`font-semibold text-base`} />
                    <Text style={tw`text-gray-700 dark:text-gray-300`}> {followText}</Text>
                </Text>
                <StackText fontSize="$2" textColor="text-gray-500 dark:text-gray-500" style={tw`mt-0.5`}>
                    {timeAgo(item.created_at)}
                </StackText>
            </Pressable>

            {isAccepted ? (
                <View style={tw`px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800`}>
                    <StackText fontSize="$3" textColor="text-gray-500 dark:text-gray-400" fontWeight="semibold">
                        Following
                    </StackText>
                </View>
            ) : (
                <PressableHaptics
                    onPress={onAccept}
                    disabled={isAccepting}
                    style={({ pressed }) => [
                        tw`rounded-2xl px-5 py-2 min-w-[88px] items-center`,
                        { backgroundColor: LOOP_ACCENT },
                        (pressed || isAccepting) && tw`opacity-70`,
                    ]}>
                    {isAccepting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <StackText fontSize="$3" textColor="text-white" fontWeight="semibold">
                            Accept
                        </StackText>
                    )}
                </PressableHaptics>
            )}
        </View>
    );
}
