import { BskyAgent, type AtpSessionData } from '@atproto/api'
import { Storage } from '@/utils/cache'

const SESSION_KEY = 'flip.atproto.session'
const SERVICE_KEY = 'flip.atproto.service'

const DEFAULT_SERVICE = 'https://bsky.social'

let agent: BskyAgent | null = null

export function getServiceUrl(): string {
  return Storage.getString(SERVICE_KEY) || DEFAULT_SERVICE
}

export function getAgent(): BskyAgent {
  if (!agent) {
    agent = new BskyAgent({ service: getServiceUrl() })
  }
  return agent
}

export function setServiceUrl(service: string): void {
  const normalized = service.startsWith('http') ? service : `https://${service}`
  Storage.set(SERVICE_KEY, normalized.replace(/\/$/, ''))
  agent = new BskyAgent({ service: getServiceUrl() })
}

export function persistSession(session: AtpSessionData): void {
  Storage.set(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  Storage.delete(SESSION_KEY)
  agent = null
}

export async function resumeSession(): Promise<boolean> {
  const raw = Storage.getString(SESSION_KEY)
  if (!raw) return false

  try {
    const session = JSON.parse(raw) as AtpSessionData
    const a = getAgent()
    await a.resumeSession(session)
    return !!a.session
  } catch {
    clearSession()
    return false
  }
}

export function getAccessToken(): string | null {
  return getAgent().session?.accessJwt ?? null
}

export function isAuthenticated(): boolean {
  return !!getAgent().session
}
