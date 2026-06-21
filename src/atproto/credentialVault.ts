import { isWeb } from '@/utils/runtime'
import * as SecureStore from 'expo-secure-store'

const CREDENTIALS_KEY = 'flip.atproto.credentials'

export type SavedCredentials = {
  identifier: string
  password: string
  service: string
}

export async function saveCredentials(
  identifier: string,
  password: string,
  service = 'bsky.social',
): Promise<void> {
  if (isWeb) return

  const payload: SavedCredentials = {
    identifier: identifier.trim(),
    password,
    service: service.trim() || 'bsky.social',
  }

  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(payload))
}

export async function getSavedCredentials(): Promise<SavedCredentials | null> {
  if (isWeb) return null

  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as SavedCredentials
    if (!parsed.identifier || !parsed.password) return null
    return parsed
  } catch {
    return null
  }
}

export async function hasSavedCredentials(): Promise<boolean> {
  return !!(await getSavedCredentials())
}

export async function getSavedIdentifier(): Promise<string | null> {
  const creds = await getSavedCredentials()
  return creds?.identifier ?? null
}

export async function clearCredentials(): Promise<void> {
  if (isWeb) return
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY)
}
