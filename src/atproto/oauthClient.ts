import { ExpoOAuthClient } from '@atproto/oauth-client-expo'
import * as WebBrowser from 'expo-web-browser'

import clientMetadata from '../../assets/oauth-client-metadata.json'

WebBrowser.maybeCompleteAuthSession()

let client: ExpoOAuthClient | null = null

export function getOAuthClient(): ExpoOAuthClient {
  if (!client) {
    client = new ExpoOAuthClient({
      handleResolver: 'https://bsky.social',
      clientMetadata,
    })
  }
  return client
}
