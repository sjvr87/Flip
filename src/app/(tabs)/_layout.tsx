import CreateCameraTabIcon from '@/components/icons/CreateCameraTabIcon';
import ExploreTabIcon from '@/components/icons/ExploreTabIcon';
import HomeTabIcon from '@/components/icons/HomeTabIcon';
import MailboxTabIcon from '@/components/icons/MailboxTabIcon';
import ProfileTabIcon from '@/components/icons/ProfileTabIcon';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import { prefetchExploreQueries } from '@/utils/explorePrefetch';
import { prepareForCameraCapture } from '@/utils/cameraCapturePrepare';
import {
    pauseAllFeedPlayers,
    resumeFeedPlaybackOnTabReturn,
    setFeedPlaybackActive,
    stopFeedAudioOnTabLeave,
} from '@/utils/feedPlaybackGuard';
import { ensureQueueMicrotask } from '@/utils/safeQueueMicrotask';
import { useAuthStore } from '@/utils/authStore';
import { useNotificationStore } from '@/utils/notificationStore';
import {
    TAB_BAR_HOME_OVERLAY_BG,
    getFlipTabBarStyle,
    useFlipTabBarMetrics,
} from '@/utils/tabBarLayout';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, usePathname } from 'expo-router';
import { useEffect, useMemo, type ReactNode } from 'react';

function ensureQueueMicrotaskForTabs(): void {
    ensureQueueMicrotask();
}
import { Platform, StyleSheet, View } from 'react-native';

/** Fixed square slot so every tab icon shares the same footprint and center. */
const TAB_ICON_SLOT_SIZE = 42;
const ICON_SIZE = 42;
/** Mailbox SVG uses a 30×30 viewBox; other tab icons use 26×26. */
const MAILBOX_ICON_SIZE = Math.round(ICON_SIZE * (30 / 26));

function TabIconSlot({ children }: { children: ReactNode }) {
    return <View style={styles.tabIconSlot}>{children}</View>;
}

/** Single uniform scrim behind Home tab icons (including safe-area inset). */
function HomeTabBarBackground() {
    return (
        <View style={[StyleSheet.absoluteFill, styles.homeTabBarOverlay]} pointerEvents="none" />
    );
}

export default function TabsLayout() {
    const { badgeCount, mailboxIconState, unreadActivity, unreadMessages } = useNotificationStore();
    const { colors, isDark } = useTheme();
    const tabBarMetrics = useFlipTabBarMetrics();
    const solidTabBarBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : colors.tabBarBorder;
    const solidTabBarStyle = useMemo(
        () => getFlipTabBarStyle(tabBarMetrics, 'solid', isDark, solidTabBarBorder),
        [tabBarMetrics, isDark, solidTabBarBorder],
    );
    const homeTabBarStyle = useMemo(
        () => getFlipTabBarStyle(tabBarMetrics, 'home', isDark, solidTabBarBorder),
        [tabBarMetrics, isDark, solidTabBarBorder],
    );
    const queryClient = useQueryClient();
    const pathname = usePathname();
    const authReady = useAuthStore((s) => s.authReady);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    useEffect(() => {
        ensureQueueMicrotaskForTabs();
    }, []);

    useEffect(() => {
        const onHomeTab =
            pathname === '/' ||
            pathname === '/index' ||
            pathname === '/(tabs)' ||
            pathname === '/(tabs)/index' ||
            pathname.endsWith('/index');
        const onCreateTab =
            pathname === '/create' || pathname === '/(tabs)/create' || pathname.endsWith('/create');
        if (onCreateTab) {
            prepareForCameraCapture();
        }
        if (!onHomeTab) {
            pauseAllFeedPlayers();
            setFeedPlaybackActive(false);
        } else {
            resumeFeedPlaybackOnTabReturn();
        }
    }, [pathname]);

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

    const tabScreenListeners = useMemo(
        () =>
            ({ route }: { route: { name: string } }) => ({
                tabPress: () => {
                    ensureQueueMicrotaskForTabs();
                    if (route.name === 'index') {
                        resumeFeedPlaybackOnTabReturn();
                    } else {
                        stopFeedAudioOnTabLeave();
                    }
                },
            }),
        [],
    );

    return (
        <Tabs
            initialRouteName="index"
            screenListeners={tabScreenListeners}
            screenOptions={{
                lazy: false,
                backBehavior: 'order',
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.tabIconInactive,
                tabBarStyle: solidTabBarStyle,
                tabBarItemStyle: {
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingHorizontal: 0,
                    marginTop: 0,
                    marginBottom: 0,
                },
                tabBarIconStyle: {
                    width: TAB_ICON_SLOT_SIZE,
                    height: TAB_ICON_SLOT_SIZE,
                },
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    href: '/',
                    tabBarAccessibilityLabel: 'Home',
                    tabBarShowLabel: false,
                    headerShown: false,
                    tabBarStyle: homeTabBarStyle,
                    tabBarBackground: () => <HomeTabBarBackground />,
                    safeAreaInsets: { bottom: 0 },
                    sceneStyle: { flex: 1, backgroundColor: 'transparent' },
                    tabBarIcon: ({ color, focused }) => (
                        <TabIconSlot>
                            <HomeTabIcon color={color} focused={focused} size={ICON_SIZE} />
                        </TabIconSlot>
                    ),
                }}
                listeners={{
                    blur: () => {
                        pauseAllFeedPlayers();
                        setFeedPlaybackActive(false);
                    },
                    focus: () => {
                        resumeFeedPlaybackOnTabReturn();
                    },
                }}
            />
            <Tabs.Screen
                name="explore"
                listeners={{
                    focus: () => {
                        ensureQueueMicrotaskForTabs();
                    },
                }}
                options={{
                    title: 'Explore',
                    href: '/explore',
                    tabBarAccessibilityLabel: 'Explore',
                    tabBarShowLabel: false,
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <TabIconSlot>
                            <ExploreTabIcon color={color} focused={focused} size={ICON_SIZE} />
                        </TabIconSlot>
                    ),
                }}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: 'Create',
                    href: '/create',
                    tabBarAccessibilityLabel: 'Create',
                    tabBarShowLabel: false,
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <TabIconSlot>
                            <CreateCameraTabIcon color={color} focused={focused} size={ICON_SIZE} />
                        </TabIconSlot>
                    ),
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: 'Inbox',
                    href: '/notifications',
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
                        <TabIconSlot>
                            <MailboxTabIcon
                                color={color}
                                focused={focused}
                                size={MAILBOX_ICON_SIZE}
                                state={mailboxIconState}
                                hasUnreadActivity={unreadActivity > 0}
                                hasUnreadMessages={unreadMessages > 0}
                            />
                        </TabIconSlot>
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    href: '/profile',
                    tabBarAccessibilityLabel: 'Profile',
                    tabBarShowLabel: false,
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <TabIconSlot>
                            <ProfileTabIcon color={color} focused={focused} size={ICON_SIZE} />
                        </TabIconSlot>
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabIconSlot: {
        width: TAB_ICON_SLOT_SIZE,
        height: TAB_ICON_SLOT_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    homeTabBarOverlay: {
        backgroundColor: TAB_BAR_HOME_OVERLAY_BG,
    },
});
