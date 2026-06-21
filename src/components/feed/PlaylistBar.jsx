import PlaylistIcon from '@/components/icons/PlaylistIcon';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import tw from 'twrnc';

function safeCount(value) {
    const n = Number(Array.isArray(value) ? value[0] : value);
    return Number.isFinite(n) ? n : 0;
}

const PlaylistBar = memo(function PlaylistBar({
    title,
    partsCount,
    currentIndex = 0,
    onPress,
    bottomInset = 0,
}) {
    const { colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';

    const barBg = isDark ? 'rgba(38,38,38,0.96)' : 'rgba(255,255,255,0.96)';
    const iconColor = isDark ? '#ffffff' : '#1f2937';
    const iconBg = isDark ? '#262626' : '#ffffff';
    const chevronColor = isDark ? '#ffffff' : '#374151';

    const total = safeCount(partsCount) || 1;
    const current = Math.min(Math.max(safeCount(currentIndex), 0), Math.max(total - 1, 0));
    const counterLabel = `${current + 1} / ${total}`;

    return (
        <View
            pointerEvents="box-none"
            style={[tw`absolute left-3 right-3`, { bottom: bottomInset + 12 }]}>
            <Pressable
                onPress={onPress}
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
                    {total > 0 && (
                        <Text
                            style={tw`text-gray-500 dark:text-gray-400 font-normal`}>{`  ·  ${counterLabel}`}</Text>
                    )}
                </Text>
                <Ionicons name="chevron-up" size={22} color={chevronColor} />
            </Pressable>
        </View>
    );
});

export default PlaylistBar;
