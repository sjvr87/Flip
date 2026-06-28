import { type ColorScheme, useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import tw from 'twrnc';

export default function AppearanceScreen() {
    const { colorScheme, colors, setColorScheme } = useTheme();

    const handleThemeSelect = (theme: ColorScheme) => {
        setColorScheme(theme);
    };

    const ThemeMockup = ({ theme }: { theme: 'light' | 'dark' }) => {
        const isLight = theme === 'light';

        return (
            <View style={tw`items-center`}>
                <View
                    style={tw`${isLight ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-700'} rounded-3xl border p-4 shadow-sm w-36 h-64`}>
                    <View
                        style={tw`${isLight ? 'bg-white' : 'bg-black'} rounded-2xl p-4 items-center mb-4`}>
                        <View style={tw`w-8 h-8 bg-gray-800 rounded-full mb-3`} />
                        <View
                            style={tw`w-16 h-1.5 ${isLight ? 'bg-gray-200' : 'bg-gray-700'} rounded mb-1`}
                        />
                        <View
                            style={tw`w-12 h-1.5 ${isLight ? 'bg-gray-200' : 'bg-gray-700'} rounded`}
                        />
                    </View>

                    <View style={tw`flex-row flex-wrap gap-1 justify-center`}>
                        <View style={tw`w-8 h-8 bg-gray-400 rounded`} />
                        <View style={tw`w-8 h-8 bg-yellow-300 rounded`} />
                        <View style={tw`w-8 h-8 bg-orange-300 rounded`} />
                        <View style={tw`w-8 h-8 bg-green-300 rounded`} />
                        <View style={tw`w-8 h-8 bg-purple-300 rounded`} />
                        <View style={tw`w-8 h-8 bg-blue-300 rounded`} />
                        <View style={tw`w-8 h-8 bg-indigo-300 rounded`} />
                        <View style={tw`w-8 h-8 bg-cyan-300 rounded`} />
                        <View style={tw`w-8 h-8 bg-red-300 rounded`} />
                    </View>
                </View>
            </View>
        );
    };

    const RadioButton = ({ selected }: { selected: boolean }) => (
        <View
            style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: selected ? '#22D3EE' : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
            {selected && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#22D3EE' }} />}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen
                options={{
                    title: 'Appearance',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerBackTitle: 'Settings',
                    headerShown: true,
                }}
            />

            <ScrollView style={tw`flex-1`}>
                <View style={{ backgroundColor: colors.background, paddingVertical: 32, paddingHorizontal: 16 }}>
                    <View style={tw`flex-row justify-around items-start mb-6`}>
                        <TouchableOpacity
                            style={tw`items-center`}
                            onPress={() => handleThemeSelect('light')}>
                            <ThemeMockup theme="light" />
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: '600',
                                    marginTop: 16,
                                    marginBottom: 12,
                                    color: colors.text,
                                }}>
                                Light
                            </Text>
                            <RadioButton selected={colorScheme === 'light'} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={tw`items-center`}
                            onPress={() => handleThemeSelect('dark')}>
                            <ThemeMockup theme="dark" />
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: '600',
                                    marginTop: 16,
                                    marginBottom: 12,
                                    color: colors.text,
                                }}>
                                Dark
                            </Text>
                            <RadioButton selected={colorScheme === 'dark'} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ height: 1, backgroundColor: colors.border }} />

                <TouchableOpacity
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 20,
                        paddingHorizontal: 20,
                        backgroundColor: colors.background,
                    }}
                    onPress={() => handleThemeSelect('device')}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>
                            System
                        </Text>
                        <Text style={{ marginTop: 4, fontSize: 14, color: colors.textSecondary }}>
                            Match your device&apos;s display settings
                        </Text>
                    </View>
                    <RadioButton selected={colorScheme === 'device'} />
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
