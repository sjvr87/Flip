import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import { useNotificationStore } from '@/utils/notificationStore';
import { getTabBarStyleInsets } from '@/utils/tabBarLayout';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICON_SIZE = 26;

function TabIcon({
    focused,
    activeName,
    inactiveName,
    color,
    size = ICON_SIZE,
}: {
    focused: boolean;
    activeName: IoniconName;
    inactiveName: IoniconName;
    color: string;
    size?: number;
}) {
    return <Ionicons name={focused ? activeName : inactiveName} size={size} color={color} />;
}

function CreateTabIcon({ isDark }: { isDark: boolean }) {
    const backgroundColor = isDark ? '#ffffff' : '#000000';
    const iconColor = isDark ? '#000000' : '#ffffff';

    return (
        <View style={[styles.createButton, { backgroundColor }]}>
            <Ionicons name="add" size={24} color={iconColor} />
        </View>
    );
}

export default function TabsLayout() {
    const { badgeCount } = useNotificationStore();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const tabBarInsets = getTabBarStyleInsets(insets.bottom);

    const displayBadgeCount = useMemo(() => {
        if (!badgeCount || badgeCount <= 0) return undefined;
        if (badgeCount > 99) return '99+';
        return String(badgeCount);
    }, [badgeCount]);

    useNotificationPolling(900000);

    return (
        <Tabs
            initialRouteName="index"
            screenOptions={{
                backBehavior: 'order',
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.tabIconInactive,
                tabBarStyle: {
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.tabBarBorder,
                    height: tabBarInsets.height,
                    paddingTop: 10,
                    paddingBottom: tabBarInsets.paddingBottom,
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarItemStyle: {
                    paddingTop: 2,
                },
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarAccessibilityLabel: 'Home',
                    tabBarShowLabel: false,
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon
                            focused={focused}
                            activeName="home"
                            inactiveName="home-outline"
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    title: 'Explore',
                    tabBarAccessibilityLabel: 'Explore',
                    tabBarShowLabel: false,
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon
                            focused={focused}
                            activeName="search"
                            inactiveName="search-outline"
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: 'Create',
                    tabBarAccessibilityLabel: 'Create',
                    tabBarShowLabel: false,
                    headerShown: false,
                    tabBarIcon: () => <CreateTabIcon isDark={isDark} />,
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: 'Notifications',
                    tabBarAccessibilityLabel: 'Notifications',
                    tabBarShowLabel: false,
                    ...(Platform.OS !== 'web' && displayBadgeCount
                        ? {
                              tabBarBadge: displayBadgeCount,
                              tabBarBadgeStyle: {
                                  fontSize: 11,
                                  fontWeight: '600',
                                  backgroundColor: colors.accent,
                              },
                          }
                        : {}),
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon
                            focused={focused}
                            activeName="heart"
                            inactiveName="heart-outline"
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarAccessibilityLabel: 'Profile',
                    tabBarShowLabel: false,
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon
                            focused={focused}
                            activeName="person-circle"
                            inactiveName="person-circle-outline"
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    createButton: {
        width: 48,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
