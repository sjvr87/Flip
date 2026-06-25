import { useTheme } from '@/contexts/ThemeContext';
import {
    copyLinkToClipboard,
    shareContent,
    shareToAppTarget,
    shareVideoFile,
    type ShareAppTarget,
} from '@/utils/sharer';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, Share, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

export default function ShareModal({ visible, item, onClose }) {
    const insets = useSafeAreaInsets();
    const { isDark } = useTheme();
    const shareMessage = 'Check out this video on Flip!';
    const postUrl = item?.url;
    const mediaUrl = item?.media?.src_url;

    if (!item) return null;

    const handleNativeShare = async () => {
        try {
            const result = await shareContent({
                message: shareMessage,
                url: postUrl,
            });

            if (result.action === Share.sharedAction) {
                onClose();
            }
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleAppShare = async (target: ShareAppTarget) => {
        try {
            const opened = await shareToAppTarget({
                target,
                message: shareMessage,
                url: postUrl,
            });
            if (opened) {
                onClose();
                return;
            }
            await handleNativeShare();
        } catch (error) {
            console.error('App share error:', error);
            Alert.alert('Share unavailable', 'Could not open that app. Try Other instead.');
        }
    };

    const handleCopyLink = async () => {
        if (!postUrl) {
            Alert.alert('Missing link', 'No shareable link is available for this post yet.');
            return;
        }
        try {
            await copyLinkToClipboard(postUrl);
            Alert.alert('Copied', 'Link copied to clipboard.');
            onClose();
        } catch (error) {
            console.error('Copy link error:', error);
            Alert.alert('Copy failed', 'Could not copy this link right now.');
        }
    };

    const handleShareVideo = async () => {
        if (!mediaUrl) {
            Alert.alert('Unavailable', 'No video source found for this post.');
            return;
        }
        try {
            const result = await shareVideoFile({
                videoUrl: mediaUrl,
                message: shareMessage,
                fallbackUrl: postUrl,
            });
            if (result.action === Share.sharedAction) {
                onClose();
            }
        } catch (error) {
            console.error('Share video error:', error);
            Alert.alert('Share failed', 'Could not share video file. Try Other instead.');
        }
    };

    const shareOptions = [
        {
            icon: 'logo-whatsapp',
            label: 'WhatsApp',
            onPress: () => handleAppShare('whatsapp'),
        },
        {
            icon: 'paper-plane-outline',
            label: 'Telegram',
            onPress: () => handleAppShare('telegram'),
        },
        {
            icon: 'chatbubble-ellipses-outline',
            label: 'Messages',
            onPress: () => handleAppShare('sms'),
        },
        {
            icon: 'logo-twitter',
            label: 'X',
            onPress: () => handleAppShare('x'),
        },
        {
            icon: 'copy-outline',
            label: 'Copy link',
            onPress: handleCopyLink,
        },
        {
            icon: 'videocam-outline',
            label: 'Share video',
            onPress: handleShareVideo,
        },
        {
            icon: 'share-outline',
            label: 'Other',
            onPress: handleNativeShare,
        },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={tw`flex-1 justify-end`}>
                <Pressable style={tw`absolute inset-0`} onPress={onClose} />
                <View
                    style={[
                        tw`bg-white dark:bg-black rounded-t-[20px] pt-3`,
                        { paddingBottom: insets.bottom + 20 },
                    ]}>
                    <View
                        style={tw`w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-sm self-center mb-5`}
                    />
                    <Text
                        style={tw`text-lg font-bold text-center mb-6 px-4 text-black dark:text-white`}>
                        Share to
                    </Text>

                    <View style={tw`flex-row flex-wrap justify-center px-4 mb-5`}>
                        {shareOptions.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={tw`items-center w-20 mb-4`}
                                onPress={option.onPress}>
                                <View
                                    style={tw`w-15 h-15 rounded-full bg-gray-100 dark:bg-gray-800 justify-center items-center mb-2`}>
                                    <Ionicons
                                        name={option.icon}
                                        size={28}
                                        color={isDark ? '#fff' : '#000'}
                                    />
                                </View>
                                <Text style={tw`text-xs text-black dark:text-white text-center`}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={tw`mt-3 py-4 items-center border-t border-gray-100 dark:border-gray-800`}
                        onPress={onClose}>
                        <Text style={tw`text-base font-semibold text-gray-600 dark:text-gray-400`}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
