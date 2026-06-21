import {
  getCurrentServer,
  getCurrentUser,
  getPreferences,
  hydrateSession,
  isAuthenticated,
  loginWithPassword,
  logout as atprotoLogout,
  refreshSession,
  updatePreferences,
  type FlipSessionUser,
} from '@/atproto/auth'
import { hasStoredSession } from '@/atproto/agent'
import { setAuthFailureHandler } from '@/utils/authEvents'
import { resetAuthFailureFlag } from '@/utils/requests'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type UserState = {
  isLoggedIn: boolean
  shouldCreateAccount: boolean
  hasCompletedOnboarding: boolean
  _hasHydrated: boolean
  user: FlipSessionUser | null
  server: string | null
  hideForYouFeed: boolean
  defaultFeed: 'following' | 'local' | 'forYou'
  autoplayVideos: boolean
  loopVideos: boolean
  muteOnOpen: boolean
  autoExpandCw: boolean
  appearance: 'light' | 'dark' | 'system'
  loginWithBluesky: (
    identifier: string,
    password: string,
    service?: string,
  ) => Promise<boolean>
  /** @deprecated Loops OAuth — use loginWithBluesky */
  loginWithOAuth: (server: string, scopes?: string) => Promise<boolean>
  loginWithApple: (server: string, credential: unknown) => Promise<boolean>
  registerWithWebBrowser: (server: string) => Promise<boolean>
  refreshAccessToken: () => Promise<boolean>
  logOut: () => void
  completeOnboarding: () => void
  resetOnboarding: () => void
  setHasHydrated: (value: boolean) => void
  setUser: (user: FlipSessionUser, server: string) => void
  clearUser: () => void
  syncAuthState: () => void
  syncPreferencesFromServer: () => Promise<void>
  setHideForYouFeed: (value: boolean) => Promise<void>
  setDefaultFeed: (feed: 'following' | 'local' | 'forYou') => Promise<void>
  updatePreference: (key: string, value: unknown) => Promise<void>
}

let sessionRestorePromise: Promise<void> | null = null

const SESSION_RESTORE_TIMEOUT_MS = 8_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[auth] ${label} timed out after ${ms}ms`)
      reject(new Error(`${label} timed out`))
    }, ms)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export const useAuthStore = create(
  persist<UserState>(
    (set, get) => ({
      isLoggedIn: false,
      shouldCreateAccount: false,
      hasCompletedOnboarding: true,
      _hasHydrated: false,
      user: null,
      server: null,
      hideForYouFeed: false,
      defaultFeed: 'following',
      autoplayVideos: true,
      loopVideos: true,
      muteOnOpen: false,
      autoExpandCw: false,
      appearance: 'system',

      loginWithBluesky: async (identifier, password, service) => {
        try {
          const user = await loginWithPassword(identifier, password, service)
          set((state) => ({
            ...state,
            isLoggedIn: true,
            user,
            server: getCurrentServer(),
          }))
          resetAuthFailureFlag()
          return true
        } catch (error) {
          console.error('Bluesky login failed:', error)
          Alert.alert(
            'Login failed',
            error instanceof Error ? error.message : 'Check your handle and app password.',
          )
          return false
        }
      },

      loginWithOAuth: async () => {
        Alert.alert('Not available', 'Flip uses Bluesky login with an app password.')
        return false
      },

      loginWithApple: async () => {
        Alert.alert('Not available', 'Flip uses Bluesky login with an app password.')
        return false
      },

      registerWithWebBrowser: async () => {
        Alert.alert(
          'Create a Bluesky account',
          'Sign up at bsky.app, then create an app password under Settings → Privacy and security.',
        )
        return false
      },

      refreshAccessToken: async () => {
        const success = await refreshSession()
        if (success) {
          get().syncAuthState()
        } else {
          get().logOut()
        }
        return success
      },

      syncAuthState: () => {
        const sessionActive = isAuthenticated()
        const profile = getCurrentUser()
        set((state) => ({
          isLoggedIn: sessionActive,
          user: profile ?? (sessionActive ? state.user : null),
          server: getCurrentServer(),
        }))
      },

      syncPreferencesFromServer: async () => {
        try {
          const prefs = await getPreferences()
          if (prefs?.settings) {
            set((state) => ({
              ...state,
              hideForYouFeed: prefs.settings.hide_for_you_feed as boolean,
              defaultFeed: prefs.settings.default_feed as UserState['defaultFeed'],
              autoplayVideos: prefs.settings.autoplay_videos as boolean,
              loopVideos: prefs.settings.loop_videos as boolean,
              muteOnOpen: prefs.settings.mute_on_open as boolean,
              autoExpandCw: prefs.settings.auto_expand_cw as boolean,
              appearance: prefs.settings.appearance as UserState['appearance'],
            }))
          }
        } catch (error) {
          console.error('Failed to sync preferences:', error)
        }
      },

      updatePreference: async (key, value) => {
        set((state) => ({ ...state, [key]: value }))
        const keyMap: Record<string, string> = {
          hideForYouFeed: 'hide_for_you_feed',
          defaultFeed: 'default_feed',
          autoplayVideos: 'autoplay_videos',
          loopVideos: 'loop_videos',
          muteOnOpen: 'mute_on_open',
          autoExpandCw: 'auto_expand_cw',
          appearance: 'appearance',
        }
        try {
          await updatePreferences({ [keyMap[key] || key]: value })
        } catch (error) {
          console.error('Failed to update preference:', error)
        }
      },

      setHideForYouFeed: async (value) => {
        await get().updatePreference('hideForYouFeed', value)
      },

      setDefaultFeed: async (feed) => {
        await get().updatePreference('defaultFeed', feed)
      },

      setUser: (user, server) => {
        set({ user, server, isLoggedIn: true })
      },

      clearUser: () => {
        set({ user: null, server: null, isLoggedIn: false })
      },

      logOut: () => {
        atprotoLogout()
        set({
          isLoggedIn: false,
          shouldCreateAccount: false,
          hasCompletedOnboarding: true,
          _hasHydrated: true,
          user: null,
          server: null,
        })
      },

      completeOnboarding: () => {
        set((state) => ({ ...state, hasCompletedOnboarding: true }))
      },

      resetOnboarding: () => {
        set((state) => ({ ...state, hasCompletedOnboarding: false }))
      },

      setHasHydrated: (value) => {
        if (!value) {
          set((state) => ({ ...state, _hasHydrated: false }))
          return
        }

        if (get()._hasHydrated) return
        if (sessionRestorePromise) return

        // Unblock routing and splash immediately; restore session in the background.
        set((state) => ({ ...state, _hasHydrated: true }))
        console.warn('[auth] store ready — restoring session in background')

        setAuthFailureHandler((reason) => {
          get().logOut()
          Alert.alert(
            'Session expired',
            reason || 'Please sign in again.',
          )
        })

        sessionRestorePromise = (async () => {
          try {
            const ok = await withTimeout(
              hydrateSession(),
              SESSION_RESTORE_TIMEOUT_MS,
              'hydrateSession',
            )
            if (ok) {
              get().syncAuthState()
              await withTimeout(
                get().syncPreferencesFromServer(),
                SESSION_RESTORE_TIMEOUT_MS,
                'syncPreferencesFromServer',
              )
            } else if (get().isLoggedIn && !(await hasStoredSession())) {
              get().clearUser()
            }
            console.warn(`[auth] session restore complete (restored=${ok})`)
          } catch (error) {
            console.warn('[auth] session restore failed:', error)
            if (get().isLoggedIn && !(await hasStoredSession())) {
              get().clearUser()
            }
          } finally {
            sessionRestorePromise = null
          }
        })()
      },
    }),
    {
      name: 'auth-store.v0.5',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) =>
        ({
          isLoggedIn: state.isLoggedIn,
          user: state.user,
          server: state.server,
          hideForYouFeed: state.hideForYouFeed,
          defaultFeed: state.defaultFeed,
          autoplayVideos: state.autoplayVideos,
          loopVideos: state.loopVideos,
          muteOnOpen: state.muteOnOpen,
          autoExpandCw: state.autoExpandCw,
          appearance: state.appearance,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
        }) as UserState,
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('[auth] store rehydrate failed:', error)
        } else {
          console.warn('[auth] store rehydrate complete')
        }
        const store = state ?? useAuthStore.getState()
        store.setHasHydrated(true)
      },
      skipHydration: true,
    },
  ),
)
