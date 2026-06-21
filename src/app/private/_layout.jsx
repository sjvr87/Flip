import { useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';

export default function PrivateLayout() {
    const { isDark, colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerBackTitleVisible: false,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: isDark ? '#ffffff' : '#000000',
                contentStyle: { backgroundColor: colors.background },
            }}
        />
    );
}
