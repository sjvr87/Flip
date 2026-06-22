import MentionText from '@/components/MentionText';
import Avatar from '@/components/Avatar';
import LinkifiedCaption from '@/components/feed/LinkifiedCaption';
import { useTheme } from '@/contexts/ThemeContext';
import type { FlipVideo } from '@/atproto/types';
import { toProfilePath } from '@/utils/profileNavigation';
import { timeAgo } from '@/utils/ui';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
/** Dimmed scrim above the sheet only — feed video peeks through; sheet stays opaque for legibility. */
const CAPTION_BACKDROP_COLOR = 'rgba(0, 0, 0, 0.48)';
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;
const CLOSE_BAR_HEIGHT = 32;

const captionModalProps = {
    animationType: 'slide' as const,
    transparent: true,
    statusBarTranslucent: Platform.OS === 'android',
};

type CaptionExpandModalProps = {
    visible: boolean;
    item: FlipVideo | null;
    onClose: () => void;
    onNavigate?: () => void;
};

export default function CaptionExpandModal({
    visible,
    item,
    onClose,
    onNavigate,
}: CaptionExpandModalProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { isDark } = useTheme();

    if (!item?.caption) return null;

    const navigateAway = (path: string) => {
        onNavigate?.();
        onClose();
        router.push(path);
    };

    return (
        <Modal visible={visible} {...captionModalProps} onRequestClose={onClose}>
            <View style={[tw`flex-1 justify-end`, { backgroundColor: 'transparent' }]}>
                <Pressable
                    style={{ flex: 1, backgroundColor: CAPTION_BACKDROP_COLOR }}
                    onPress={onClose}
                />
                <View
                    style={[
                        tw`bg-white dark:bg-black rounded-t-2xl overflow-hidden`,
                        { height: SHEET_HEIGHT, paddingBottom: insets.bottom + 12 },
                    ]}>
                    <View
                        style={[
                            tw`flex-row justify-end items-center`,
                            { height: CLOSE_BAR_HEIGHT, paddingHorizontal: 12 },
                        ]}>
                        <TouchableOpacity
                            onPress={onClose}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Close">
                            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={tw`flex-1 bg-white dark:bg-black`}
                        contentContainerStyle={tw`px-4 pb-4`}
                        showsVerticalScrollIndicator>
                        <TouchableOpacity
                            style={tw`flex-row items-center mb-3`}
                            onPress={() => navigateAway(toProfilePath(item.account.id))}>
                            <Avatar url={item.account.avatar} size={36} />
                            <View style={tw`ml-3 flex-1`}>
                                <MentionText
                                    username={item.account.username}
                                    style={tw`text-[15px] font-bold`}
                                />
                                <Text style={tw`text-[13px] text-gray-600 dark:text-gray-400 mt-0.5`}>
                                    {timeAgo(item.created_at)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <LinkifiedCaption
                            caption={item.caption}
                            tags={item.tags || []}
                            mentions={item.mentions || []}
                            style={tw`text-[15px] text-black dark:text-white leading-6`}
                            onHashtagPress={(tag) => navigateAway(`/private/search?query=${tag}`)}
                            onMentionPress={(username, profileId) =>
                                navigateAway(toProfilePath(profileId ?? username))
                            }
                        />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
