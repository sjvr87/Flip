import MentionText from '@/components/MentionText';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText } from '@/components/ui/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import tw from 'twrnc';

type ProfileQrModalProps = {
    visible: boolean;
    profileUrl?: string;
    username?: string | null;
    onClose: () => void;
};

export default function ProfileQrModal({
    visible,
    profileUrl,
    username,
    onClose,
}: ProfileQrModalProps) {
    const { isDark } = useTheme();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                style={tw`flex-1 bg-black/60 justify-center items-center px-6`}
                onPress={onClose}>
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    style={tw`w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl px-6 pt-5 pb-6 items-center`}>
                    <View style={tw`w-full flex-row items-center justify-between mb-4`}>
                        <StackText style={tw`text-lg font-semibold text-black dark:text-white`}>
                            Scan to open profile
                        </StackText>
                        <PressableHaptics
                            onPress={onClose}
                            accessibilityLabel="Close"
                            style={tw`p-1 rounded-full`}>
                            <Ionicons
                                name="close"
                                size={24}
                                color={isDark ? '#e5e5e5' : '#1f1f1f'}
                            />
                        </PressableHaptics>
                    </View>

                    {username ? (
                        <MentionText
                            username={username}
                            style={{ fontWeight: '600', fontSize: 18, marginBottom: 16 }}
                        />
                    ) : null}

                    {profileUrl ? (
                        <View
                            style={tw`bg-white p-4 rounded-2xl mb-4`}
                            accessibilityLabel="Profile QR code">
                            <QRCode value={profileUrl} size={200} />
                        </View>
                    ) : (
                        <StackText style={tw`text-sm text-zinc-500 mb-4 text-center`}>
                            Profile link unavailable
                        </StackText>
                    )}

                    {profileUrl ? (
                        <StackText
                            numberOfLines={2}
                            style={tw`text-xs text-zinc-500 dark:text-zinc-400 text-center`}>
                            {profileUrl.replace(/^https?:\/\//, '')}
                        </StackText>
                    ) : null}
                </Pressable>
            </Pressable>
        </Modal>
    );
}
