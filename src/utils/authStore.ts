import {
  getCurrentServer,
  getCurrentUser,
  getPreferences,
  hydrateSession,
  isAuthenticated,
  loginWithPassword,
  logout as atprotoLogout,
  refreshSession,
  trySilentRelogin,
  updatePreferences,
  type FlipSessionUser,
} from '@/atproto/auth'
import { hasStoredSession, trackSessionRestore, tryRefreshSession } from '@/atproto/agent'
import { clearCredentials, getSavedCredentials, saveCredentials } from '@/atproto/credentialVault'
import { canUseBiometrics } from '@/utils/biometricAuth'
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
  hideAdultContent: boolean
  defaultFeed: 'following' | 'local' | 'forYou'
  autoplayVideos: boolean
  loopVideos: boolean
  muteOnOpen: boolean
  autoExpandCw: boolean
  appearance: 'light' | 'dark' | 'system'
  rememberLogin: boolean
  requireBiometric: boolean
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
  restoreSessionInBackground: () => Promise<boolean> | null
  setUser: (user: FlipSessionUser, server: string) => void
  clearUser: () => void
  syncAuthState: () => void
  syncPreferencesFromServer: () => Promise<void>
  setHideForYouFeed: (value: boolean) => Promise<void>
  setHideAdultContent: (value: boolean) => void
  setDefaultFeed: (feed: 'following' | 'local' | 'forYou') => Promise<void>
  updatePreference: (key: string, value: unknown) => Promise<void>
  setRememberLogin: (value: boolean) => Promise<void>
  setRequireBiometric: (value: boolean) => void
  unlockWithSavedCredentials: () => Promise<boolean>
  clearSavedLogin: () => Promise<void>
}

let sessionRestorePromise: Promise<boolean> | null = null
let loginInFlight = false

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
      hideAdultContent: true,
      defaultFeed: 'following',
      autoplayVideos: true,
      loopVideos: true,
      muteOnOpen: false,
      autoExpandCw: false,
      appearance: 'system',
      rememberLogin: true,
      requireBiometric: false,

      loginWithBluesky: async (identifier, password, service) => {
        loginInFlight = true
        try {
          const user = await loginWithPassword(identifier, password, service)
          const { rememberLogin } = get()

          if (rememberLogin) {
            await saveCredentials(identifier, password, service || 'bsky.social')
            const biometricsAvailable = await canUseBiometrics()
            if (biometricsAvailable && !get().requireBiometric) {
              set({ requireBiometric: true })
            }
          } else {
            await clearCredentials()
          }

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
        } finally {
          loginInFlight = false
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

      setHideAdultContent: (value) => {
        set({ hideAdultContent: value })
      },

      setDefaultFeed: async (feed) => {
        await get().updatePreference('defaultFeed', feed)
      },

      unlockWithSavedCredentials: async () => {
        const ok = await trySilentRelogin()
        if (ok) {
          get().syncAuthState()
          resetAuthFailureFlag()
        }
        return ok
      },

      clearSavedLogin: async () => {
        await clearCredentials()
        set({ requireBiometric: false })
      },

      setRememberLogin: async (value) => {
        set({ rememberLogin: value })
        if (!value) {
          await clearCredentials()
          set({ requireBiometric: false })
        }
      },

      setRequireBiometric: (value) => {
        set({ requireBiometric: value })
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
          requireBiometric: false,
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

        if (get()._hasHydrated) {
          if (!sessionRestorePromise) {
            void get().restoreSessionInBackground()
          }
          return
        }

        // Unblock routing immediately; session restore must not delay feed mount.
        set((state) => ({ ...state, _hasHydrated: true }))
        void get().restoreSessionInBackground()
      },

      restoreSessionInBackground: () => {
        if (sessionRestorePromise) {
          return sessionRestorePromise
        }

        console.warn('[auth] restoring session in background')

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
              ).catch(() => {})
              console.warn('[auth] session restore complete (restored=true)')
              return true
            }

            const savedCreds = await getSavedCredentials()
            const { rememberLogin, requireBiometric } = get()
            const needsBiometric =
              rememberLogin && requireBiometric && (await canUseBiometrics())

            if (savedCreds && rememberLogin && !needsBiometric) {
              console.warn('[auth] attempting silent re-login with saved credentials')
              const reloginOk = await withTimeout(
                trySilentRelogin(),
                SESSION_RESTORE_TIMEOUT_MS,
                'trySilentRelogin',
              ).catch(() => false)

              if (reloginOk) {
                get().syncAuthState()
                await withTimeout(
                  get().syncPreferencesFromServer(),
                  SESSION_RESTORE_TIMEOUT_MS,
                  'syncPreferencesFromServer',
                ).catch(() => {})
                console.warn('[auth] session restore complete (silent re-login=true)')
                return true
              }
            }

            const stored = await hasStoredSession()
            if (stored) {
              if (!get().isLoggedIn) {
                set({ isLoggedIn: true })
              }
            } else if (get().isLoggedIn && !isAuthenticated() && !loginInFlight) {
              get().clearUser()
            }

            console.warn(
              `[auth] session restore complete (restored=false, savedCreds=${!!savedCreds})`,
            )
            return stored
          } catch (error) {
            console.warn('[auth] session restore failed:', error)
            const savedCreds = await getSavedCredentials()
            const { rememberLogin, requireBiometric } = get()
            const needsBiometric =
              rememberLogin && requireBiometric && (await canUseBiometrics())

            if (savedCreds && rememberLogin && !needsBiometric) {
              const reloginOk = await trySilentRelogin().catch(() => false)
              if (reloginOk) {
                get().syncAuthState()
                return true
              }
            }

            const stored = await hasStoredSession()
            if (stored) {
              if (!get().isLoggedIn) {
                set({ isLoggedIn: true })
              }
              return true
            }
            if (get().isLoggedIn && !isAuthenticated() && !loginInFlight) {
              get().clearUser()
            }
            return false
          } finally {
            sessionRestorePromise = null
          }
        })()
        trackSessionRestore(sessionRestorePromise)
        return sessionRestorePromise
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
          hideAdultContent: state.hideAdultContent,
          defaultFeed: state.defaultFeed,
          autoplayVideos: state.autoplayVideos,
          loopVideos: state.loopVideos,
          muteOnOpen: state.muteOnOpen,
          autoExpandCw: state.autoExpandCw,
          appearance: state.appearance,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          rememberLogin: state.rememberLogin,
          requireBiometric: state.requireBiometric,
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

setAuthFailureHandler(async (reason) => {
  const refreshed = await tryRefreshSession()
  if (refreshed) {
    useAuthStore.getState().syncAuthState()
    resetAuthFailureFlag()
    return
  }

  const { rememberLogin, requireBiometric } = useAuthStore.getState()
  const savedCreds = await getSavedCredentials()
  const needsBiometric =
    rememberLogin && requireBiometric && (await canUseBiometrics())

  if (savedCreds && rememberLogin && !needsBiometric) {
    const reloginOk = await trySilentRelogin()
    if (reloginOk) {
      useAuthStore.getState().syncAuthState()
      resetAuthFailureFlag()
      return
    }
  }

  const hasStored = await hasStoredSession()
  if (hasStored) {
    console.warn('[auth] auth failure ignored — stored session kept:', reason)
    resetAuthFailureFlag()
    return
  }

  useAuthStore.getState().logOut()
  Alert.alert('Session expired', reason || 'Please sign in again.')
})
