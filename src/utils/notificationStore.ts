import { notificationBadgeCount } from '@/utils/requests';
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
            const count = await notificationBadgeCount();
            if (!isLoggedIn()) return;
            set({ badgeCount: count.data.unread_count, lastFetched: now, isLoading: false });
        } catch (error) {
            if (error?.message === 'auth_revoked') return;
            console.error('Failed to fetch badge count:', error);
            set({ isLoading: false });
        }
    },

    refetchBadgeCount: async () => {
        if (!isLoggedIn()) return;

        const now = Date.now();
        set({ isLoading: true });
        try {
            const count = await notificationBadgeCount();
            if (!isLoggedIn()) return;
            set({ badgeCount: count.data.unread_count, lastFetched: now, isLoading: false });
        } catch (error) {
            if (error?.message === 'auth_revoked') return;
            console.error('Failed to fetch badge count:', error);
            set({ isLoading: false });
        }
    },

    resetBadgeCount: () => set({ badgeCount: 0, lastFetched: null }),
}));
