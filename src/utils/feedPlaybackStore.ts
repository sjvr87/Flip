import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type FeedPlaybackState = {
  /** When true, feed videos play without sound. Persisted across sessions. */
  feedMuted: boolean
  /** Video IDs the user manually paused; survives brief scroll away. */
  manuallyPausedIds: string[]
  setFeedMuted: (muted: boolean) => void
  toggleFeedMuted: () => void
  setManuallyPaused: (videoId: string, paused: boolean) => void
  isManuallyPaused: (videoId: string) => boolean
  clearManuallyPaused: (videoId: string) => void
}

export const useFeedPlaybackStore = create<FeedPlaybackState>()(
  persist(
    (set, get) => ({
      feedMuted: false,
      manuallyPausedIds: [],
      setFeedMuted: (muted) => set({ feedMuted: muted }),
      toggleFeedMuted: () => set((s) => ({ feedMuted: !s.feedMuted })),
      setManuallyPaused: (videoId, paused) =>
        set((s) => {
          const ids = new Set(s.manuallyPausedIds)
          if (paused) {
            ids.add(videoId)
          } else {
            ids.delete(videoId)
          }
          return { manuallyPausedIds: [...ids] }
        }),
      isManuallyPaused: (videoId) => get().manuallyPausedIds.includes(videoId),
      clearManuallyPaused: (videoId) =>
        set((s) => ({
          manuallyPausedIds: s.manuallyPausedIds.filter((id) => id !== videoId),
        })),
    }),
    {
      name: 'flip.feed.playback',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ feedMuted: state.feedMuted }),
    },
  ),
)
