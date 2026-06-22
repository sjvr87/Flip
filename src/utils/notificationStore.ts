import {
    fetchInboxUnreadBreakdown,
    fetchUnreadFollowCount,
    fetchUnreadNotificationCount,
    notificationTypeMarkAllAsRead,
} from '@/atproto/notifications';
import { fetchUnreadDmCount } from '@/atproto/chat';
import type { MailboxIconState } from '@/components/icons/MailboxTabIcon';
import { create } from 'zustand';

const LIKE_NOTIFICATION_TYPES = new Set(['video.like', 'comment.like', 'commentReply.like']);

/** Bluesky listNotifications can lag after updateSeen — keep zeros briefly. */
const ACTIVITY_MARK_GRACE_MS = 10_000;

interface NotificationState {
    badgeCount: number;
    unreadMessages: number;
    unreadLikes: number;
    unreadFollows: number;
    /** Non-follower notifications (likes, comments, etc.) — matches inbox activity row. */
    unreadActivity: number;
    /** Messages > likes > follows when multiple categories are unread. */
    mailboxIconState: MailboxIconState;
    isLoading: boolean;
    lastFetched: number | null;
    /** Timestamp of last activity mark-read; stale refetches are clamped during grace window. */
    activityMarkedReadAt: number | null;
    refetchBadgeCount: () => Promise<void>;
    fetchBadgeCount: () => Promise<void>;
    markInboxViewed: () => Promise<void>;
    markActivityViewed: () => Promise<void>;
    markActivityNotificationRead: (type: string) => void;
    clearActivityUnread: () => void;
    resetBadgeCount: () => void;
}

function isLoggedIn(): boolean {
    const { useAuthStore } = require('@/utils/authStore');
    return useAuthStore.getState().isLoggedIn;
}

function computeMailboxState(
    unreadMessages: number,
    unreadLikes: number,
    unreadFollows: number,
): MailboxIconState {
    if (unreadMessages > 0) return 'messages';
    if (unreadLikes > 0) return 'likes';
    if (unreadFollows > 0) return 'follows';
    return 'allRead';
}

function shouldPreserveActivityZeros(activityMarkedReadAt: number | null): boolean {
    return (
        activityMarkedReadAt !== null &&
        Date.now() - activityMarkedReadAt < ACTIVITY_MARK_GRACE_MS
    );
}

function applyBreakdown(
    breakdown: Awaited<ReturnType<typeof fetchInboxUnreadBreakdown>>,
    unreadMessages: number,
    activityMarkedReadAt: number | null,
) {
    const preserveActivityZeros = shouldPreserveActivityZeros(activityMarkedReadAt);
    const unreadLikes = preserveActivityZeros ? 0 : breakdown.unreadLikes;
    const unreadActivity = preserveActivityZeros ? 0 : breakdown.unreadActivity;

    return {
        badgeCount: breakdown.badgeCount + unreadMessages,
        unreadMessages,
        unreadLikes,
        unreadFollows: breakdown.unreadFollows,
        unreadActivity,
        mailboxIconState: computeMailboxState(
            unreadMessages,
            unreadLikes,
            breakdown.unreadFollows,
        ),
    };
}

async function refreshBadgeCountOnly(unreadMessages: number): Promise<void> {
    try {
        const badgeCount = await fetchUnreadNotificationCount();
        useNotificationStore.setState((s) => ({
            badgeCount: badgeCount + unreadMessages,
            lastFetched: Date.now(),
        }));
    } catch {
        // Non-fatal
    }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    badgeCount: 0,
    unreadMessages: 0,
    unreadLikes: 0,
    unreadFollows: 0,
    unreadActivity: 0,
    mailboxIconState: 'allRead',
    isLoading: false,
    lastFetched: null,
    activityMarkedReadAt: null,

    fetchBadgeCount: async () => {
        if (!isLoggedIn()) return;

        const now = Date.now();
        const { lastFetched } = get();
        if (lastFetched && now - lastFetched < 30000) {
            return;
        }

        set({ isLoading: true });
        try {
            const unreadMessages = await fetchUnreadDmCount();
            const breakdown = await fetchInboxUnreadBreakdown(unreadMessages);
            if (!isLoggedIn()) return;
            set({
                ...applyBreakdown(breakdown, unreadMessages, get().activityMarkedReadAt),
                lastFetched: now,
                isLoading: false,
            });
        } catch {
            set({ isLoading: false });
        }
    },

    refetchBadgeCount: async () => {
        if (!isLoggedIn()) return;

        const now = Date.now();
        set({ isLoading: true });
        try {
            const unreadMessages = await fetchUnreadDmCount();
            const breakdown = await fetchInboxUnreadBreakdown(unreadMessages);
            if (!isLoggedIn()) return;
            set({
                ...applyBreakdown(breakdown, unreadMessages, get().activityMarkedReadAt),
                lastFetched: now,
                isLoading: false,
            });
        } catch {
            set({ isLoading: false });
        }
    },

    markActivityNotificationRead: (type: string) => {
        const markedAt = Date.now();
        set((s) => {
            const isLike = LIKE_NOTIFICATION_TYPES.has(type);
            const unreadLikes = isLike ? Math.max(0, s.unreadLikes - 1) : s.unreadLikes;
            const unreadActivity = Math.max(0, s.unreadActivity - 1);
            return {
                activityMarkedReadAt: markedAt,
                unreadLikes,
                unreadActivity,
                mailboxIconState: computeMailboxState(
                    s.unreadMessages,
                    unreadLikes,
                    s.unreadFollows,
                ),
            };
        });
    },

    clearActivityUnread: () => {
        const markedAt = Date.now();
        set((s) => ({
            activityMarkedReadAt: markedAt,
            unreadLikes: 0,
            unreadActivity: 0,
            mailboxIconState: computeMailboxState(s.unreadMessages, 0, s.unreadFollows),
        }));
    },

    markActivityViewed: async () => {
        if (!isLoggedIn()) return;

        const markedAt = Date.now();
        try {
            await notificationTypeMarkAllAsRead('activity');
            const [unreadMessages, unreadFollows] = await Promise.all([
                fetchUnreadDmCount(),
                fetchUnreadFollowCount(),
            ]);
            if (!isLoggedIn()) return;
            set({
                activityMarkedReadAt: markedAt,
                unreadLikes: 0,
                unreadActivity: 0,
                unreadMessages,
                unreadFollows,
                mailboxIconState: computeMailboxState(unreadMessages, 0, unreadFollows),
            });
            await refreshBadgeCountOnly(unreadMessages);
        } catch (error) {
            if (__DEV__) {
                console.warn('[notifications] markActivityViewed failed', error);
            }
        }
    },

    markInboxViewed: async () => {
        if (!isLoggedIn()) return;

        const markedAt = Date.now();
        try {
            await notificationTypeMarkAllAsRead('activity');
            const [unreadMessages, unreadFollows] = await Promise.all([
                fetchUnreadDmCount(),
                fetchUnreadFollowCount(),
            ]);
            if (!isLoggedIn()) return;
            set({
                activityMarkedReadAt: markedAt,
                unreadLikes: 0,
                unreadActivity: 0,
                unreadMessages,
                unreadFollows,
                mailboxIconState: computeMailboxState(unreadMessages, 0, unreadFollows),
            });
            await refreshBadgeCountOnly(unreadMessages);
        } catch (error) {
            if (__DEV__) {
                console.warn('[notifications] markInboxViewed failed', error);
            }
        }
    },

    resetBadgeCount: () =>
        set({
            badgeCount: 0,
            unreadMessages: 0,
            unreadLikes: 0,
            unreadFollows: 0,
            unreadActivity: 0,
            mailboxIconState: 'allRead',
            lastFetched: null,
            activityMarkedReadAt: null,
        }),
}));
