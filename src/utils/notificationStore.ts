import {
    fetchInboxUnreadBreakdown,
    fetchUnreadFollowCount,
    notificationTypeMarkAllAsRead,
} from '@/atproto/notifications';
import { fetchUnreadDmCount } from '@/atproto/chat';
import type { MailboxIconState } from '@/components/icons/MailboxTabIcon';
import { create } from 'zustand';

interface NotificationState {
    badgeCount: number;
    unreadMessages: number;
    unreadLikes: number;
    unreadFollows: number;
    /** Messages > likes > follows when multiple categories are unread. */
    mailboxIconState: MailboxIconState;
    isLoading: boolean;
    lastFetched: number | null;
    refetchBadgeCount: () => Promise<void>;
    fetchBadgeCount: () => Promise<void>;
    markInboxViewed: () => Promise<void>;
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

export const useNotificationStore = create<NotificationState>((set, get) => ({
    badgeCount: 0,
    unreadMessages: 0,
    unreadLikes: 0,
    unreadFollows: 0,
    mailboxIconState: 'allRead',
    isLoading: false,
    lastFetched: null,

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
                badgeCount: breakdown.badgeCount + unreadMessages,
                unreadMessages,
                unreadLikes: breakdown.unreadLikes,
                unreadFollows: breakdown.unreadFollows,
                mailboxIconState: computeMailboxState(
                    unreadMessages,
                    breakdown.unreadLikes,
                    breakdown.unreadFollows,
                ),
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
                badgeCount: breakdown.badgeCount + unreadMessages,
                unreadMessages,
                unreadLikes: breakdown.unreadLikes,
                unreadFollows: breakdown.unreadFollows,
                mailboxIconState: computeMailboxState(
                    unreadMessages,
                    breakdown.unreadLikes,
                    breakdown.unreadFollows,
                ),
                lastFetched: now,
                isLoading: false,
            });
        } catch {
            set({ isLoading: false });
        }
    },

    markInboxViewed: async () => {
        if (!isLoggedIn()) return;

        try {
            await notificationTypeMarkAllAsRead('activity');
            const [unreadMessages, unreadFollows] = await Promise.all([
                fetchUnreadDmCount(),
                fetchUnreadFollowCount(),
            ]);
            set({
                unreadLikes: 0,
                unreadMessages,
                unreadFollows,
                mailboxIconState: computeMailboxState(unreadMessages, 0, unreadFollows),
            });
            await get().refetchBadgeCount();
        } catch {
            // Non-fatal — inbox still usable
        }
    },

    resetBadgeCount: () =>
        set({
            badgeCount: 0,
            unreadMessages: 0,
            unreadLikes: 0,
            unreadFollows: 0,
            mailboxIconState: 'allRead',
            lastFetched: null,
        }),
}));
