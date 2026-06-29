import { ProfileQrCode } from '@/components/profile/ProfileQrCode';
import { useTheme } from '@/contexts/ThemeContext';
import { getProfileHandle, getProfileUrl } from '@/utils/profileUrl';
import { shareContent } from '@/utils/sharer';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

type ProfileUser = {
    username?: string | null;
    acct?: string | null;
    url?: string | null;
    id?: string | null;
};

type Props = {
    visible: boolean;
    user?: ProfileUser | null;
    onClose: () => void;
    onCopyHandle: () => void;
    onShowQr: () => void;
};

function SheetRow({
    icon,
    label,
    onPress,
    isDark,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    isDark: boolean;
}) {
    return (
        <TouchableOpacity
            style={tw`flex-row items-center py-4 px-5 gap-4 border-b border-gray-100 dark:border-gray-800`}
            onPress={onPress}>
            <Ionicons name={icon} size={22} color={isDark ? '#fff' : '#000'} />
            <Text style={tw`text-base flex-1 text-black dark:text-white`}>{label}</Text>
        </TouchableOpacity>
    );
}

export function ProfileHandleSheet({ visible, user, onClose, onCopyHandle, onShowQr }: Props) {
    const insets = useSafeAreaInsets();
    const { isDark } = useTheme();
    const handle = getProfileHandle(user);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={tw`flex-1 justify-end`}>
                <Pressable style={tw`absolute inset-0 bg-black/40`} onPress={onClose} />
                <View
                    style={[
                        tw`bg-white dark:bg-black rounded-t-[20px] pt-3`,
                        { paddingBottom: insets.bottom + 12 },
                    ]}>
                    <View
                        style={tw`w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-sm self-center mb-4`}
                    />
                    <Text
                        style={tw`text-lg font-bold text-center mb-2 px-4 text-black dark:text-white`}>
                        {handle || 'Profile'}
                    </Text>
                    <Text
                        style={tw`text-sm text-center mb-4 px-4 text-gray-500 dark:text-gray-400`}>
                        See you on the flip side
                    </Text>

                    <SheetRow
                        icon="at-outline"
                        label="Copy handle"
                        onPress={onCopyHandle}
                        isDark={isDark}
                    />
                    <SheetRow
                        icon="qr-code-outline"
                        label="Show profile QR code"
                        onPress={onShowQr}
                        isDark={isDark}
                    />
                    <SheetRow
                        icon="share-outline"
                        label="Share profile link"
                        onPress={async () => {
                            const url = getProfileUrl(user);
                            if (!url) return;
                            onClose();
                            try {
                                await shareContent({
                                    message: 'Check out my account on Flip!',
                                    url,
                                });
                            } catch (error) {
                                console.error('Share profile error:', error);
                            }
                        }}
                        isDark={isDark}
                    />

                    <TouchableOpacity style={tw`mt-2 py-4 items-center`} onPress={onClose}>
                        <Text style={tw`text-base font-semibold text-gray-600 dark:text-gray-400`}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

export function ProfileQrSheet({
    visible,
    user,
    onClose,
}: {
    visible: boolean;
    user?: ProfileUser | null;
    onClose: () => void;
}) {
    const insets = useSafeAreaInsets();
    const { isDark } = useTheme();
    const profileUrl = getProfileUrl(user);
    const handle = getProfileHandle(user);

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={tw`flex-1 justify-center items-center`}>
                <Pressable style={tw`absolute inset-0 bg-black/60`} onPress={onClose} />
                <View
                    style={[
                        tw`mx-6 rounded-3xl px-6 py-6 items-center bg-white dark:bg-zinc-900`,
                        { marginBottom: insets.bottom },
                    ]}>
                    <Text style={tw`text-lg font-bold mb-1 text-black dark:text-white`}>
                        Profile QR
                    </Text>
                    <Text style={tw`text-sm mb-5 text-gray-500 dark:text-gray-400`}>{handle}</Text>
                    {profileUrl ? (
                        <ProfileQrCode
                            value={profileUrl}
                            size={220}
                            color={isDark ? '#ffffff' : '#000000'}
                            backgroundColor={isDark ? '#18181b' : '#ffffff'}
                        />
                    ) : null}
                    <Text
                        numberOfLines={2}
                        style={tw`text-xs text-center mt-4 text-gray-500 dark:text-gray-400`}>
                        {profileUrl}
                    </Text>
                    <TouchableOpacity style={tw`mt-5 py-3 px-8`} onPress={onClose}>
                        <Text style={tw`text-base font-semibold text-[#22D3EE]`}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
