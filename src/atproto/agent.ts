import { BskyAgent, type AtpSessionData } from '@atproto/api'

import { triggerAuthFailure } from '@/utils/authEvents'
import { Storage } from '@/utils/cache'

import { isWeb } from '@/utils/runtime'

import * as SecureStore from 'expo-secure-store'



const SESSION_KEY = 'flip.atproto.session'

const SERVICE_KEY = 'flip.atproto.service'



const DEFAULT_SERVICE = 'https://bsky.social'



let agent: BskyAgent | null = null

let pendingSessionRestore: Promise<boolean> | null = null

/** Set when the server definitively rejects the refresh token (not transient/network). */
let lastRefreshRejected = false

/** Buffer before JWT expiry to refresh proactively (seconds). */
const TOKEN_EXPIRY_BUFFER_SEC = 60

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired — sign in again') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

export function trackSessionRestore(promise: Promise<boolean>): void {
  pendingSessionRestore = promise.finally(() => {
    pendingSessionRestore = null
  })
}

async function awaitSessionRestore(): Promise<void> {
  if (pendingSessionRestore) {
    await pendingSessionRestore
  }
}

function parseJwtPayload(token: string): { exp?: number } | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = globalThis.atob(padded)
    return JSON.parse(json) as { exp?: number }
  } catch {
    return null
  }
}

export function isAccessTokenExpired(accessJwt: string | undefined | null): boolean {
  if (!accessJwt) return true
  const payload = parseJwtPayload(accessJwt)
  if (!payload?.exp) return false
  return Date.now() / 1000 >= payload.exp - TOKEN_EXPIRY_BUFFER_SEC
}

export function isAuthTokenError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof SessionExpiredError) return true

  const err = error as { error?: string; status?: number }
  return (
    err.error === 'ExpiredToken' ||
    err.error === 'InvalidToken' ||
    err.error === 'AuthMissing' ||
    err.status === 401
  )
}

export function isRefreshTokenRejected(error: unknown): boolean {
  if (!error) return false
  const err = error as { error?: string; status?: number }
  if (err.error === 'ExpiredToken' || err.error === 'InvalidToken' || err.error === 'AuthMissing') {
    return true
  }
  return err.status === 400 || err.status === 401
}

export function wasRefreshTokenRejected(): boolean {
  return lastRefreshRejected
}

/** @atproto/api 0.20+: refreshSession lives on CredentialSession, not AtpAgent. */
async function refreshAgentSession(a: BskyAgent): Promise<void> {
  await a.sessionManager.refreshSession()
}

export async function tryRefreshSession(): Promise<boolean> {
  lastRefreshRejected = false
  await restoreSessionFromStorageIfEmpty()

  const a = getAgent()
  if (!a.session?.refreshJwt) return false

  try {
    await refreshAgentSession(a)
    if (a.session) {
      await persistSession(a.session)
      return true
    }
    return false
  } catch (error) {
    console.warn('[auth] refreshSession failed:', error)
    if (isRefreshTokenRejected(error)) {
      lastRefreshRejected = true
      clearSession()
      return false
    }
    // Transient/offline — keep stored session for retry later.
    return !!a.session
  }
}

/** Reload persisted tokens when the in-memory agent lost its session (e.g. after a 401). */
export async function restoreSessionFromStorageIfEmpty(): Promise<boolean> {
  if (getAgent().session) return true
  return resumeSession()
}

async function recoverAuth(): Promise<boolean> {
  await restoreSessionFromStorageIfEmpty()

  const refreshed = await tryRefreshSession()
  if (refreshed && !isAccessTokenExpired(getAgent().session?.accessJwt)) {
    return true
  }

  try {
    const { trySilentRelogin } = await import('./auth')
    if (await trySilentRelogin()) {
      return true
    }
  } catch (error) {
    console.warn('[auth] silent re-login during recoverAuth failed:', error)
  }

  return false
}

/**
 * Ensure the agent has a non-expired access token before authenticated API calls.
 */
export async function ensureFreshSession(): Promise<boolean> {
  await awaitSessionRestore()
  await restoreSessionFromStorageIfEmpty()

  const a = getAgent()
  if (!a.session) return false
  if (!isAccessTokenExpired(a.session.accessJwt)) return true

  return tryRefreshSession()
}

function failExpiredSession(reason?: string): never {
  const message = reason ?? 'Session expired — sign in again'
  if (wasRefreshTokenRejected()) {
    triggerAuthFailure(message)
  }
  throw new SessionExpiredError(message)
}

/**
 * Run an authenticated ATProto call with proactive refresh and one retry on token errors.
 */
export async function withAuthenticatedFetch<T>(fn: () => Promise<T>): Promise<T> {
  await awaitSessionRestore()
  await restoreSessionFromStorageIfEmpty()

  const fresh = await ensureFreshSession()
  if (!fresh) {
    const recovered = await recoverAuth()
    if (!recovered) {
      if (!(await hasStoredSession()) || wasRefreshTokenRejected()) {
        failExpiredSession()
      }
      throw new SessionExpiredError('Session expired — sign in again')
    }
  }

  try {
    return await fn()
  } catch (error) {
    if (!isAuthTokenError(error)) throw error

    await restoreSessionFromStorageIfEmpty()
    const recovered = await recoverAuth()
    if (!recovered) {
      if (wasRefreshTokenRejected()) {
        failExpiredSession()
      }
      throw new SessionExpiredError('Session expired — sign in again')
    }

    try {
      return await fn()
    } catch (retryError) {
      if (isAuthTokenError(retryError)) {
        if (wasRefreshTokenRejected()) {
          failExpiredSession()
        }
        throw new SessionExpiredError('Session expired — sign in again')
      }
      throw retryError
    }
  }
}



function createAgent(service: string): BskyAgent {

  return new BskyAgent({

    service,

    persistSession: (_event, session) => {
      // Only persist positive session updates. BskyAgent may emit null on transient
      // refresh failures — never wipe stored tokens unless logout() calls clearSession().
      if (session) {
        void persistSession(session)
      }
    },

  })

}



export function getServiceUrl(): string {

  return Storage.getString(SERVICE_KEY) || DEFAULT_SERVICE

}



export function getAgent(): BskyAgent {

  if (!agent) {

    agent = createAgent(getServiceUrl())

  }

  return agent

}



export function setServiceUrl(service: string): void {

  const normalized = service.startsWith('http') ? service : `https://${service}`

  const url = normalized.replace(/\/$/, '')

  Storage.set(SERVICE_KEY, url)

  agent = createAgent(url)

  if (!isWeb) {

    void SecureStore.setItemAsync(SERVICE_KEY, url)

  }

}



export async function persistSession(session: AtpSessionData): Promise<void> {

  const json = JSON.stringify(session)

  Storage.set(SESSION_KEY, json)

  if (!isWeb) {

    await SecureStore.setItemAsync(SESSION_KEY, json)

    console.warn('[auth] session persisted (MMKV + SecureStore)')

  }

}



export function clearSession(): void {

  Storage.delete(SESSION_KEY)

  Storage.delete(SERVICE_KEY)

  if (!isWeb) {

    void SecureStore.deleteItemAsync(SESSION_KEY)

    void SecureStore.deleteItemAsync(SERVICE_KEY)

  }

  agent = null

}



export async function hasStoredSession(): Promise<boolean> {

  if (Storage.getString(SESSION_KEY)) return true

  if (!isWeb) {

    return !!(await SecureStore.getItemAsync(SESSION_KEY))

  }

  return false

}



export async function resumeSession(): Promise<boolean> {

  if (!isWeb) {

    const storedService = await SecureStore.getItemAsync(SERVICE_KEY)

    if (storedService) {

      Storage.set(SERVICE_KEY, storedService)

      agent = createAgent(storedService)

    }

  }



  let raw = Storage.getString(SESSION_KEY)

  if (!raw && !isWeb) {

    raw = (await SecureStore.getItemAsync(SESSION_KEY)) ?? undefined

    if (raw) {

      Storage.set(SESSION_KEY, raw)

    }

  }

  if (!raw) return false

  console.warn('[auth] session loaded from storage')



  let session: AtpSessionData

  try {

    session = JSON.parse(raw) as AtpSessionData

  } catch {

    clearSession()

    return false

  }



  const a = getAgent()
  const sm = a.sessionManager

  // Load tokens without AtpAgent.resumeSession() — it always POSTs refreshSession (no body).
  if (sm.session?.refreshJwt !== session.refreshJwt) {
    sm.session = session
    sm.refreshSessionPromise = undefined
  }

  if (!sm.session) return false

  if (!isAccessTokenExpired(session.accessJwt)) {
    await persistSession(sm.session)
    return true
  }

  const refreshed = await tryRefreshSession()
  if (!refreshed) {
    if (wasRefreshTokenRejected()) {
      return false
    }
    if (isAccessTokenExpired(sm.session?.accessJwt)) {
      console.warn('[auth] access token still expired after resume')
    }
  }

  if (sm.session) {
    await persistSession(sm.session)
  }

  return !!sm.session

}



export function getAccessToken(): string | null {

  return getAgent().session?.accessJwt ?? null

}



export function isAuthenticated(): boolean {

  return !!getAgent().session

}

