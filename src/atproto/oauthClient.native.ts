import * as WebBrowser from 'expo-web-browser'

import clientMetadata from '../../assets/oauth-client-metadata.json'

import type { ExpoOAuthClient as ExpoOAuthClientType } from '@atproto/oauth-client-expo/dist/expo-oauth-client.native'

// @atproto/oauth-client-expo dist/index.js imports ./expo-oauth-client.js, but only
// platform files are published — Metro cannot resolve the package entry.
require('@atproto/oauth-client-expo/dist/polyfill.native')

const { ExpoOAuthClient } = require('@atproto/oauth-client-expo/dist/expo-oauth-client.native')

WebBrowser.maybeCompleteAuthSession()

let client: ExpoOAuthClientType | null = null
let initError: Error | null = null

export function getOAuthClient(): ExpoOAuthClientType {
  if (initError) {
    throw initError
  }
  if (!client) {
    try {
      client = new ExpoOAuthClient({
        handleResolver: 'https://bsky.social',
        clientMetadata,
      })
    } catch (error) {
      initError =
        error instanceof Error ? error : new Error('OAuth client init failed', { cause: error })
      console.warn('[auth] OAuth client init failed:', initError)
      throw initError
    }
  }
  return client
}
