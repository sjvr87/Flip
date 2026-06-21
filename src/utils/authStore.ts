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
import { setAuthFailureHandler } from '@/utils/authEvents'
import { resetAuthFailureFlag } from '@/utils/requests'
import * as SecureStore from 'expo-secure-store'
import { Alert } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Storage } from './cache'

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
        set({
          isLoggedIn: isAuthenticated(),
          user: getCurrentUser(),
          server: getCurrentServer(),
        })
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
        SecureStore.deleteItemAsync('auth-store.v0.5').catch(() => {})
      },

      completeOnboarding: () => {
        set((state) => ({ ...state, hasCompletedOnboarding: true }))
      },

      resetOnboarding: () => {
        set((state) => ({ ...state, hasCompletedOnboarding: false }))
      },

      setHasHydrated: (value) => {
        set((state) => ({ ...state, _hasHydrated: value }))

        if (value) {
          setAuthFailureHandler((reason) => {
            get().logOut()
            Alert.alert(
              'Session expired',
              reason || 'Please sign in again.',
            )
          })

          hydrateSession().then((ok) => {
            if (ok) {
              get().syncAuthState()
              get().syncPreferencesFromServer()
            }
          })
        }
      },
    }),
    {
      name: 'auth-store.v0.5',
      storage: createJSONStorage(() => ({
        getItem: (name) => Storage.getString(name) ?? null,
        setItem: (name, value) => Storage.set(name, value),
        removeItem: (name) => Storage.delete(name),
      })),
      partialize: (state) =>
        ({
          hideForYouFeed: state.hideForYouFeed,
          defaultFeed: state.defaultFeed,
          autoplayVideos: state.autoplayVideos,
          loopVideos: state.loopVideos,
          muteOnOpen: state.muteOnOpen,
          autoExpandCw: state.autoExpandCw,
          appearance: state.appearance,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
        }) as UserState,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
