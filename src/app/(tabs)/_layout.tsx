import ExploreTabIcon from '@/components/icons/ExploreTabIcon';
import HomeTabIcon from '@/components/icons/HomeTabIcon';
import MailboxTabIcon from '@/components/icons/MailboxTabIcon';
import ProfileTabIcon from '@/components/icons/ProfileTabIcon';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import { prefetchExploreQueries } from '@/utils/explorePrefetch';
import { useAuthStore } from '@/utils/authStore';
import { useNotificationStore } from '@/utils/notificationStore';
import { useFlipTabBarMetrics, getTabBarStyleFromMetrics } from '@/utils/tabBarLayout';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const ICON_SIZE = 26;

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
    const { badgeCount, mailboxIconState } = useNotificationStore();
    const { colors, isDark } = useTheme();
    const tabBarMetrics = useFlipTabBarMetrics();
    const tabBarLayout = getTabBarStyleFromMetrics(tabBarMetrics);
    const queryClient = useQueryClient();
    const authReady = useAuthStore((s) => s.authReady);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    useEffect(() => {
        if (!authReady || !isLoggedIn) return;
        prefetchExploreQueries(queryClient);
    }, [authReady, isLoggedIn, queryClient]);

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
                    paddingTop: tabBarLayout.paddingTop,
                    paddingBottom: tabBarLayout.paddingBottom,
                    ...(Platform.OS === 'android'
                        ? { minHeight: tabBarLayout.height }
                        : { height: tabBarLayout.height }),
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
                        <HomeTabIcon color={color} focused={focused} size={ICON_SIZE} />
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
                        <ExploreTabIcon color={color} focused={focused} size={ICON_SIZE} />
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
                    title: 'Inbox',
                    tabBarAccessibilityLabel: 'Inbox',
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
                        <MailboxTabIcon
                            color={color}
                            focused={focused}
                            size={ICON_SIZE}
                            state={mailboxIconState}
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
                        <ProfileTabIcon color={color} focused={focused} size={ICON_SIZE} />
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
