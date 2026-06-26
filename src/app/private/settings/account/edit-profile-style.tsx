import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchProfileTheme, saveProfileTheme } from '@/atproto';
import { fetchSelfAccount } from '@/utils/requests';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import tw from 'twrnc';

const BACKGROUND_SWATCHES = ['#0f172a', '#1e1b4b', '#134e4a', '#3f1d1d', '#ffffff', '#f5f5f4'];
const ACCENT_SWATCHES = ['#22d3ee', '#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#fb7185'];

function SwatchRow({
    label,
    colors,
    selected,
    onSelect,
}: {
    label: string;
    colors: string[];
    selected?: string;
    onSelect: (color: string) => void;
}) {
    return (
        <View style={tw`px-5 py-4`}>
            <Text style={tw`text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3`}>
                {label}
            </Text>
            <View style={tw`flex-row flex-wrap gap-3`}>
                {colors.map((color, index) => {
                    const active = selected === color;
                    return (
                        <PressableHaptics
                            key={`${label}-${color}-${index}`}
                            onPress={() => onSelect(color)}
                            style={[
                                tw`w-12 h-12 rounded-full border-2`,
                                {
                                    backgroundColor: color,
                                    borderColor: active ? '#22d3ee' : '#d1d5db',
                                },
                            ]}
                            accessibilityLabel={`${label} ${color}`}>
                            {active ? (
                                <View style={tw`flex-1 items-center justify-center`}>
                                    <Ionicons name="checkmark" size={20} color="#000" />
                                </View>
                            ) : null}
                        </PressableHaptics>
                    );
                })}
            </View>
        </View>
    );
}

export default function EditProfileStyleScreen() {
    const { isDark } = useTheme();
    const queryClient = useQueryClient();

    const { data: user } = useQuery({
        queryKey: ['fetchSelfAccount', 'self'],
        queryFn: async () => (await fetchSelfAccount()).data,
    });

    const { data: theme, isLoading } = useQuery({
        queryKey: ['profileTheme', user?.id],
        queryFn: () => fetchProfileTheme(user!.id),
        enabled: !!user?.id,
    });

    const saveMutation = useMutation({
        mutationFn: saveProfileTheme,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profileTheme', user?.id] });
        },
    });

    const backgroundColor = theme?.backgroundColor;
    const accentColor = theme?.accentColor;

    const handleBackground = (color: string) => {
        saveMutation.mutate({ backgroundColor: color, accentColor: theme?.accentColor });
    };

    const handleAccent = (color: string) => {
        saveMutation.mutate({ backgroundColor: theme?.backgroundColor, accentColor: color });
    };

    const handleReset = () => {
        saveMutation.mutate({ backgroundColor: '', accentColor: '', backgroundImage: '' });
    };

    return (
        <View style={tw`flex-1 bg-white dark:bg-black`}>
            <Stack.Screen
                options={{
                    title: 'Profile style',
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                    headerBackTitle: 'Account',
                }}
            />

            {isLoading ? (
                <View style={tw`flex-1 items-center justify-center`}>
                    <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
                </View>
            ) : (
                <ScrollView>
                    <View style={tw`px-5 pt-5 pb-2`}>
                        <Text style={tw`text-sm text-gray-500 dark:text-gray-400`}>
                            Personalize your Flip file with background and accent colors. Visitors
                            see this on your profile.
                        </Text>
                    </View>

                    <View
                        style={[
                            tw`mx-5 my-3 rounded-2xl p-5 items-center border border-gray-200 dark:border-gray-800`,
                            backgroundColor ? { backgroundColor } : tw`bg-gray-50 dark:bg-gray-900`,
                        ]}>
                        <View
                            style={[
                                tw`w-16 h-16 rounded-full mb-3`,
                                { backgroundColor: accentColor || '#22d3ee' },
                            ]}
                        />
                        <Text
                            style={tw`text-base font-bold ${
                                backgroundColor === '#ffffff' || backgroundColor === '#f5f5f4'
                                    ? 'text-gray-900'
                                    : 'text-white'
                            }`}>
                            Preview
                        </Text>
                    </View>

                    <SwatchRow
                        label="Background"
                        colors={BACKGROUND_SWATCHES}
                        selected={backgroundColor}
                        onSelect={handleBackground}
                    />
                    <SwatchRow
                        label="Accent"
                        colors={ACCENT_SWATCHES}
                        selected={accentColor}
                        onSelect={handleAccent}
                    />

                    <PressableHaptics
                        onPress={handleReset}
                        disabled={saveMutation.isPending}
                        style={tw`mx-5 mt-2 mb-8 py-3.5 rounded-xl bg-gray-100 dark:bg-gray-900 items-center`}>
                        {saveMutation.isPending ? (
                            <ActivityIndicator size="small" />
                        ) : (
                            <Text
                                style={tw`text-base font-semibold text-gray-700 dark:text-gray-200`}>
                                Reset to default
                            </Text>
                        )}
                    </PressableHaptics>
                </ScrollView>
            )}
        </View>
    );
}
