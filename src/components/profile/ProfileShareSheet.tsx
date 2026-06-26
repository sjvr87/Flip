import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText } from '@/components/ui/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

type ProfileShareSheetProps = {
    visible: boolean;
    username?: string | null;
    onClose: () => void;
    onCopyLink: () => void;
    onShare: () => void;
    onShowQr: () => void;
};

const OPTIONS = [
    {
        id: 'copy',
        label: 'Copy link',
        icon: 'copy-outline' as const,
        onSelect: (props: ProfileShareSheetProps) => props.onCopyLink,
    },
    {
        id: 'share',
        label: 'Share profile',
        icon: 'share-outline' as const,
        onSelect: (props: ProfileShareSheetProps) => props.onShare,
    },
    {
        id: 'qr',
        label: 'QR code',
        icon: 'qr-code-outline' as const,
        onSelect: (props: ProfileShareSheetProps) => props.onShowQr,
    },
];

export default function ProfileShareSheet(props: ProfileShareSheetProps) {
    const { visible, username, onClose } = props;
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const iconColor = isDark ? '#e5e5e5' : '#1f1f1f';

    const handleSelect = (action: () => void) => {
        onClose();
        action();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={tw`flex-1 bg-black/40 justify-end`} onPress={onClose}>
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    style={[
                        tw`bg-white dark:bg-zinc-900 rounded-t-3xl`,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                    ]}>
                    <View style={tw`items-center pt-3 pb-2`}>
                        <View style={tw`w-10 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700`} />
                    </View>

                    {username ? (
                        <StackText
                            style={tw`text-center text-sm text-zinc-500 dark:text-zinc-400 mb-1`}>
                            @{username}
                        </StackText>
                    ) : null}

                    <View style={tw`px-2 pt-1`}>
                        {OPTIONS.map((option, index) => (
                            <View key={option.id}>
                                {index > 0 ? (
                                    <View style={tw`h-px bg-zinc-100 dark:bg-zinc-800 mx-4`} />
                                ) : null}
                                <PressableHaptics
                                    onPress={() => handleSelect(option.onSelect(props))}
                                    style={tw`flex-row items-center px-4 py-4 mx-2 rounded-2xl`}>
                                    <Ionicons name={option.icon} size={22} color={iconColor} />
                                    <StackText
                                        style={tw`flex-1 ml-3 text-[15px] text-black dark:text-white font-medium`}>
                                        {option.label}
                                    </StackText>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={isDark ? '#71717a' : '#a1a1aa'}
                                    />
                                </PressableHaptics>
                            </View>
                        ))}
                    </View>

                    <View style={tw`h-px bg-zinc-100 dark:bg-zinc-800 mx-4 mt-1`} />

                    <PressableHaptics onPress={onClose} style={tw`mx-4 mt-2 py-3.5 rounded-2xl`}>
                        <StackText
                            style={tw`text-center text-[15px] font-medium text-zinc-500 dark:text-zinc-400`}>
                            Cancel
                        </StackText>
                    </PressableHaptics>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
