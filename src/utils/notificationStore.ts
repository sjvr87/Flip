import { fetchUnreadNotificationCount } from '@/atproto/notifications';
import { create } from 'zustand';

interface NotificationState {
    badgeCount: number;
    isLoading: boolean;
    lastFetched: number | null;
    refetchBadgeCount: () => Promise<void>;
    fetchBadgeCount: () => Promise<void>;
    resetBadgeCount: () => void;
}

function isLoggedIn(): boolean {
    const { useAuthStore } = require('@/utils/authStore');
    return useAuthStore.getState().isLoggedIn;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    badgeCount: 0,
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
            const unreadCount = await fetchUnreadNotificationCount();
            if (!isLoggedIn()) return;
            set({ badgeCount: unreadCount, lastFetched: now, isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },

    refetchBadgeCount: async () => {
        if (!isLoggedIn()) return;

        const now = Date.now();
        set({ isLoading: true });
        try {
            const unreadCount = await fetchUnreadNotificationCount();
            if (!isLoggedIn()) return;
            set({ badgeCount: unreadCount, lastFetched: now, isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },

    resetBadgeCount: () => set({ badgeCount: 0, lastFetched: null }),
}));
