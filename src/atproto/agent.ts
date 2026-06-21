import { BskyAgent, type AtpSessionData } from '@atproto/api'

import { Storage } from '@/utils/cache'

import { isWeb } from '@/utils/runtime'

import * as SecureStore from 'expo-secure-store'



const SESSION_KEY = 'flip.atproto.session'

const SERVICE_KEY = 'flip.atproto.service'



const DEFAULT_SERVICE = 'https://bsky.social'



let agent: BskyAgent | null = null



function createAgent(service: string): BskyAgent {

  return new BskyAgent({

    service,

    persistSession: (_event, session) => {

      if (session) {

        void persistSession(session)

      } else {

        clearSession()

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



  let session: AtpSessionData

  try {

    session = JSON.parse(raw) as AtpSessionData

  } catch {

    clearSession()

    return false

  }



  const a = getAgent()

  try {

    await a.resumeSession(session)

  } catch (error) {

    // @atproto/api sets session before refresh; rejection means refresh failed (often offline).

    console.warn('[auth] resumeSession refresh failed:', error)

  }



  if (!a.session) return false



  await persistSession(a.session)

  return true

}



export function getAccessToken(): string | null {

  return getAgent().session?.accessJwt ?? null

}



export function isAuthenticated(): boolean {

  return !!getAgent().session

}

