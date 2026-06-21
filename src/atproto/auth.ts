import { profileToFlipUser } from './adapters'
import {
  clearSession,
  getAgent,
  getServiceUrl,
  isAuthenticated,
  persistSession,
  resumeSession,
  setServiceUrl,
  tryRefreshSession,
  withAuthenticatedFetch,
} from './agent'
import { clearCredentials, getSavedCredentials } from './credentialVault'
import type { FlipAppConfig, FlipUserProfile } from './types'
import { Storage } from '@/utils/cache'

const PROFILE_KEY = 'flip.user.profile'

export type FlipSessionUser = FlipUserProfile

export async function loginWithPassword(
  identifier: string,
  password: string,
  service?: string,
): Promise<FlipSessionUser> {
  if (service) {
    setServiceUrl(service)
  }

  const agent = getAgent()
  let result: Awaited<ReturnType<typeof agent.login>>
  try {
    result = await agent.login({ identifier, password })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not reach Bluesky. Check your connection and try again.'
    throw new Error(message)
  }

  if (!result.success || !agent.session) {
    const message =
      typeof (result as { data?: { message?: string } }).data?.message === 'string'
        ? (result as { data: { message: string } }).data.message
        : 'Invalid handle or app password.'
    throw new Error(message)
  }

  await persistSession(agent.session)

  // Bluesky login — drop stale Loops REST credentials so routing uses ATProto.
  Storage.delete('app.token')
  Storage.delete('app.instance')

  const profile = await agent.getProfile({ actor: agent.session.did })
  const user = profileToFlipUser(profile.data, true)
  Storage.set(PROFILE_KEY, JSON.stringify(user))

  return user
}

export async function hydrateSession(): Promise<boolean> {
  const ok = await resumeSession()
  if (!ok) return false

  // Prefer ATProto routing — drop stale Loops REST credentials from older sessions.
  Storage.delete('app.token')
  Storage.delete('app.instance')

  try {
    const profile = await withAuthenticatedFetch(async () => {
      const agent = getAgent()
      return agent.getProfile({ actor: agent.session!.did })
    })
    const user = profileToFlipUser(profile.data, true)
    Storage.set(PROFILE_KEY, JSON.stringify(user))
    return true
  } catch (error) {
    console.warn('[auth] profile refresh during hydrate failed:', error)
    return !!getAgent().session
  }
}

export async function refreshSession(): Promise<boolean> {
  return tryRefreshSession()
}

export function getCurrentUser(): FlipSessionUser | null {
  const raw = Storage.getString(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as FlipSessionUser
  } catch {
    return null
  }
}

export function getCurrentServer(): string {
  try {
    const url = new URL(getServiceUrl())
    return url.host
  } catch {
    return 'bsky.social'
  }
}

export async function trySilentRelogin(): Promise<boolean> {
  const creds = await getSavedCredentials()
  if (!creds) return false

  try {
    await loginWithPassword(creds.identifier, creds.password, creds.service)
    return true
  } catch (error) {
    console.warn('[auth] silent re-login failed:', error)
    return false
  }
}

export function logout(): void {
  clearSession()
  void clearCredentials()
  Storage.delete(PROFILE_KEY)
  Storage.delete('app.token')
  Storage.delete('app.instance')
}

export { isAuthenticated, getServiceUrl }

export async function fetchSelfAccount(): Promise<{ data: FlipUserProfile }> {
  const agent = getAgent()
  const did = agent.session?.did
  if (!did) throw new Error('Not authenticated')

  const profile = await agent.getProfile({ actor: did })
  const user = profileToFlipUser(profile.data, true)
  Storage.set(PROFILE_KEY, JSON.stringify(user))

  return { data: user }
}

export async function getConfiguration(): Promise<FlipAppConfig> {
  return {
    fyf: true,
    registration: false,
  }
}

export async function getPreferences(): Promise<{ settings: Record<string, unknown> }> {
  return {
    settings: {
      hide_for_you_feed: false,
      default_feed: 'following',
      autoplay_videos: true,
      loop_videos: true,
      mute_on_open: false,
      auto_expand_cw: false,
      appearance: 'system',
    },
  }
}

export async function updatePreferences(_prefs: Record<string, unknown>): Promise<void> {
  // Stored locally in authStore for Flip; no Bluesky prefs API yet
}

export async function openBrowser(url: string, _options?: Record<string, unknown>): Promise<void> {
  const WebBrowser = await import('expo-web-browser')
  await WebBrowser.openBrowserAsync(url)
}
