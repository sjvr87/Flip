import PlaylistIcon from '@/components/icons/PlaylistIcon';
import { useTheme } from '@/contexts/ThemeContext';
import { parseCount } from '@/utils/ui';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import tw from 'twrnc';

const PlaylistBar = memo(function PlaylistBar({
    title,
    partsCount,
    currentIndex = 0,
    onPress,
    bottomInset = 0,
}) {
    const { isDark } = useTheme();

    const barBg = isDark ? 'rgba(38,38,38,0.96)' : 'rgba(255,255,255,0.96)';
    const iconColor = isDark ? '#ffffff' : '#1f2937';
    const iconBg = isDark ? '#262626' : '#ffffff';
    const chevronColor = isDark ? '#ffffff' : '#374151';

    const total = Math.max(parseCount(partsCount), 1);
    const current = Math.min(Math.max(parseCount(currentIndex), 0), total - 1);
    const counterLabel = `${current + 1} / ${total}`;

    return (
        <View
            style={[
                tw`absolute left-3 right-3`,
                { bottom: bottomInset + 12, zIndex: 30, elevation: 30 },
            ]}>
            <Pressable
                onPress={onPress}
                disabled={!onPress}
                style={({ pressed }) => [
                    tw`flex-row items-center rounded-full px-4 py-3.5`,
                    { backgroundColor: barBg },
                    pressed && tw`opacity-80`,
                ]}>
                <PlaylistIcon filled size={20} color={iconColor} bgColor={iconBg} />
                <Text
                    style={tw`flex-1 ml-3 text-gray-900 dark:text-white text-base font-semibold`}
                    numberOfLines={1}>
                    {title}
                    <Text
                        style={tw`text-gray-500 dark:text-gray-400 font-normal`}>{`  ·  ${counterLabel}`}</Text>
                </Text>
                <Ionicons name="chevron-up" size={22} color={chevronColor} />
            </Pressable>
        </View>
    );
});

export default PlaylistBar;
