import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText } from '@/components/ui/Stack';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { useTheme } from '@/contexts/ThemeContext';
import { ScrollView, View } from 'react-native';
import tw from 'twrnc';

export type ActivityHubFilter = 'activity' | 'mentions' | 'likesFavorites' | 'comments';

export const ACTIVITY_HUB_FILTERS: { type: ActivityHubFilter; label: string }[] = [
    { type: 'activity', label: 'All' },
    { type: 'mentions', label: 'Mentions' },
    { type: 'likesFavorites', label: 'Likes & favorites' },
    { type: 'comments', label: 'Comments' },
];

type Props = {
    selected: ActivityHubFilter;
    onSelect: (filter: ActivityHubFilter) => void;
};

export function ActivityFilterChips({ selected, onSelect }: Props) {
    const { isDark } = useTheme();

    return (
        <View style={tw`py-2`}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={tw`px-4 gap-2`}>
                {ACTIVITY_HUB_FILTERS.map((opt) => {
                    const active = opt.type === selected;
                    return (
                        <PressableHaptics
                            key={opt.type}
                            onPress={() => onSelect(opt.type)}
                            style={[
                                tw`px-4 py-2 rounded-full border`,
                                active
                                    ? { backgroundColor: LOOP_ACCENT, borderColor: LOOP_ACCENT }
                                    : {
                                          borderColor: isDark ? '#3a3a3c' : '#e5e7eb',
                                          backgroundColor: isDark ? '#1c1c1e' : '#f9fafb',
                                      },
                            ]}>
                            <StackText
                                fontSize="$3"
                                fontWeight={active ? 'semibold' : 'normal'}
                                style={{ color: active ? '#fff' : isDark ? '#e5e5e5' : '#374151' }}>
                                {opt.label}
                            </StackText>
                        </PressableHaptics>
                    );
                })}
            </ScrollView>
        </View>
    );
}
