import type { FlipAudioSource } from '@/atproto/types'
import { create } from 'zustand'

type PendingAudioReuseState = {
  pending: FlipAudioSource | null
  setPending: (source: FlipAudioSource) => void
  clearPending: () => void
  takePending: () => FlipAudioSource | null
}

/** Stash audio-reuse attribution while navigating to the create flow. */
export const usePendingAudioReuseStore = create<PendingAudioReuseState>((set, get) => ({
  pending: null,
  setPending: (source) => set({ pending: source }),
  clearPending: () => set({ pending: null }),
  takePending: () => {
    const source = get().pending
    set({ pending: null })
    return source
  },
}))
